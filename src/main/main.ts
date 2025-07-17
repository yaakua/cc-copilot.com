import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ProxyServer } from './proxy'
import { ClaudeCodeManager } from './claude-code'
import { DataStore } from './store'
// import icon from '../../resources/icon.png?asset'

// Global instances
let proxyServer: ProxyServer
let claudeCodeManager: ClaudeCodeManager
let dataStore: DataStore

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
  claudeCodeManager = new ClaudeCodeManager(mainWindow)
  dataStore = new DataStore()

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

function setupIpcHandlers(): void {
  // Terminal IPC handlers
  ipcMain.handle('terminal:input', async (_, data: string) => {
    claudeCodeManager.sendInput(data)
  })

  // Claude Code IPC handlers
  ipcMain.handle('claude-code:start', async () => {
    await claudeCodeManager.start()
  })

  ipcMain.handle('claude-code:stop', async () => {
    await claudeCodeManager.stop()
  })

  // Project IPC handlers
  ipcMain.handle('projects:get', () => {
    return dataStore.getProjects()
  })

  ipcMain.handle('projects:create', (_, name: string) => {
    return dataStore.createProject(name)
  })

  ipcMain.handle('projects:delete', (_, id: string) => {
    dataStore.deleteProject(id)
  })

  // Session IPC handlers
  ipcMain.handle('sessions:get', (_, projectId: string) => {
    return dataStore.getSessions(projectId)
  })

  ipcMain.handle('sessions:create', (_, projectId: string, name: string) => {
    return dataStore.createSession(projectId, name)
  })

  ipcMain.handle('sessions:delete', (_, id: string) => {
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
  if (claudeCodeManager) {
    await claudeCodeManager.stop()
  }
  if (proxyServer) {
    await proxyServer.stop()
  }
  
  if (process.platform !== 'darwin') app.quit()
})

// Handle app quit
app.on('before-quit', async () => {
  if (claudeCodeManager) {
    await claudeCodeManager.stop()
  }
  if (proxyServer) {
    await proxyServer.stop()
  }
})