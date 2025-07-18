import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ProxyServer } from './proxy'
import { PtyManager } from './pty-manager'
import { DataStore } from './store'
// import icon from '../../resources/icon.png?asset'

// Declare global for mainWindow
declare global {
  var mainWindow: BrowserWindow | undefined
}

// Global instances
let proxyServer: ProxyServer
let dataStore: DataStore

// Session-specific PtyManager cache
const ptyManagers = new Map<string, PtyManager>()
let currentActiveSessionId: string | null = null

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    }
  })

  // Initialize services
  proxyServer = new ProxyServer()
  dataStore = new DataStore()
  
  // Store mainWindow reference for creating PtyManagers later
  global.mainWindow = mainWindow

  // Setup IPC handlers
  setupIpcHandlers()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // Start proxy server when window is ready
    proxyServer.start().catch(console.error)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function getOrCreatePtyManager(sessionId: string): PtyManager {
  if (!ptyManagers.has(sessionId)) {
    const mainWindow = global.mainWindow
    if (!mainWindow) {
      throw new Error('Main window not available')
    }
    
    console.log(`[Session] Creating new PtyManager for session: ${sessionId}`)
    const manager = new PtyManager(mainWindow)
    ptyManagers.set(sessionId, manager)
    
    // Auto-start PTY for new sessions
    const projects = dataStore.getProjects()
    for (const project of projects) {
      const sessions = dataStore.getSessions(project.id)
      const session = sessions.find(s => s.id === sessionId)
      if (session) {
        manager.start({ workingDirectory: project.path }).catch(console.error)
        break
      }
    }
  }
  
  return ptyManagers.get(sessionId)!
}

function getCurrentPtyManager(): PtyManager | null {
  if (!currentActiveSessionId) {
    return null
  }
  return ptyManagers.get(currentActiveSessionId) || null
}

function setupIpcHandlers(): void {
  // Terminal IPC handlers
  ipcMain.handle('terminal:input', async (_, data: string) => {
    const manager = getCurrentPtyManager()
    if (manager) {
      manager.sendInput(data)
    } else {
      console.warn('[Terminal] No active session, cannot send input')
    }
  })

  ipcMain.handle('terminal:resize', async (_, cols: number, rows: number) => {
    const manager = getCurrentPtyManager()
    if (manager) {
      manager.resize(cols, rows)
    } else {
      console.warn('[Terminal] No active session, cannot resize')
    }
  })

  // PTY IPC handlers
  ipcMain.handle('pty:start', async (_, options: any) => {
    const manager = getCurrentPtyManager()
    if (manager) {
      await manager.start(options)
    } else {
      console.warn('[PTY] No active session, cannot start')
    }
  })

  ipcMain.handle('pty:stop', async () => {
    const manager = getCurrentPtyManager()
    if (manager) {
      await manager.stop()
    } else {
      console.warn('[PTY] No active session, cannot stop')
    }
  })

  ipcMain.handle('pty:change-directory', async (_, path: string) => {
    const manager = getCurrentPtyManager()
    if (manager) {
      manager.changeDirectory(path)
    } else {
      console.warn('[PTY] No active session, cannot change directory')
    }
  })

  ipcMain.handle('pty:set-env', async (_, key: string, value: string) => {
    const manager = getCurrentPtyManager()
    if (manager) {
      manager.setEnvironmentVariable(key, value)
    } else {
      console.warn('[PTY] No active session, cannot set environment variable')
    }
  })

  ipcMain.handle('pty:get-env', async (_, key: string) => {
    const manager = getCurrentPtyManager()
    if (manager) {
      return manager.getEnvironmentVariable(key)
    } else {
      console.warn('[PTY] No active session, cannot get environment variable')
      return undefined
    }
  })

  ipcMain.handle('pty:get-all-env', async () => {
    const manager = getCurrentPtyManager()
    if (manager) {
      return manager.getAllEnvironmentVariables()
    } else {
      console.warn('[PTY] No active session, cannot get environment variables')
      return {}
    }
  })

  ipcMain.handle('pty:start-claude-code', async (_, workingDirectory?: string) => {
    const manager = getCurrentPtyManager()
    if (manager) {
      manager.startClaudeCode(workingDirectory)
    } else {
      console.warn('[PTY] No active session, cannot start claude-code')
    }
  })

  // Project IPC handlers
  ipcMain.handle('projects:get', () => {
    return dataStore.getProjects()
  })

  ipcMain.handle('projects:create', (_, name: string, path: string) => {
    return dataStore.createProject(name, path)
  })

  ipcMain.handle('projects:delete', (_, id: string) => {
    dataStore.deleteProject(id)
  })

  ipcMain.handle('projects:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Project Directory'
    })
    
    if (result.canceled) {
      return null
    }
    
    return result.filePaths[0]
  })

  ipcMain.handle('projects:get-history', () => {
    return dataStore.getProjectHistory()
  })

  ipcMain.handle('projects:clear-history', () => {
    dataStore.clearProjectHistory()
  })

  ipcMain.handle('projects:extract-name', (_, path: string) => {
    return basename(path)
  })

  // Session IPC handlers
  ipcMain.handle('sessions:get', (_, projectId: string) => {
    return dataStore.getSessions(projectId)
  })

  ipcMain.handle('sessions:create', (_, projectId: string, name?: string) => {
    const session = dataStore.createSession(projectId, name)
    // Auto-activate newly created session
    currentActiveSessionId = session.id
    // Create and start PtyManager for the new session
    getOrCreatePtyManager(session.id)
    return session
  })

  ipcMain.handle('sessions:activate', (_, sessionId: string) => {
    console.log(`[Session] Activating session: ${sessionId}`)
    currentActiveSessionId = sessionId
    // Create PtyManager if it doesn't exist
    getOrCreatePtyManager(sessionId)
    return true
  })

  ipcMain.handle('sessions:delete', (_, id: string) => {
    // Stop and cleanup PtyManager if it exists
    const manager = ptyManagers.get(id)
    if (manager) {
      manager.stop().catch(console.error)
      ptyManagers.delete(id)
    }
    
    // Clear current active session if it's being deleted
    if (currentActiveSessionId === id) {
      currentActiveSessionId = null
    }
    
    dataStore.deleteSession(id)
  })

  // Settings IPC handlers
  ipcMain.handle('settings:get', () => {
    return dataStore.getSettings()
  })

  ipcMain.handle('settings:update', (_, settings: any) => {
    dataStore.updateSettings(settings)
  })

  // Statistics IPC handlers
  ipcMain.handle('stats:get', (_, scope: 'session' | 'project' | 'global', id?: string) => {
    return dataStore.getStats(scope, id)
  })

  // Proxy IPC handlers
  ipcMain.handle('proxy:set-model', (_, modelId: string) => {
    const settings = dataStore.getSettings()
    const provider = settings.apiProviders.find(p => p.id === modelId)
    if (provider) {
      proxyServer.setTarget(provider.baseUrl)
      dataStore.updateSettings({ activeModelId: modelId })
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.cccopilot')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', async () => {
  // Clean up services before quitting
  await cleanupAllServices()
  
  if (process.platform !== 'darwin') app.quit()
})

// Handle app quit
app.on('before-quit', async () => {
  await cleanupAllServices()
})

async function cleanupAllServices(): Promise<void> {
  // Stop all PtyManager instances
  for (const [sessionId, manager] of ptyManagers) {
    console.log(`[Cleanup] Stopping PtyManager for session: ${sessionId}`)
    try {
      await manager.stop()
    } catch (error) {
      console.error(`[Cleanup] Error stopping PtyManager for session ${sessionId}:`, error)
    }
  }
  ptyManagers.clear()
  currentActiveSessionId = null
  
  // Stop proxy server
  if (proxyServer) {
    try {
      await proxyServer.stop()
    } catch (error) {
      console.error('[Cleanup] Error stopping proxy server:', error)
    }
  }
}