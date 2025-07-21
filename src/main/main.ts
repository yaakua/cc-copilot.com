import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import * as path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ProxyServer } from './proxy'
import { PtyManager } from './pty-manager'
import { DataStore, Session } from './store'
import { SettingsManager } from './settings'
import { logger } from './logger'

// Global instances
let proxyServer: ProxyServer
let dataStore: DataStore
let settingsManager: SettingsManager

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
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Initialize services
  settingsManager = new SettingsManager()
  dataStore = new DataStore()
  proxyServer = new ProxyServer(settingsManager)

  mainWindow.on('ready-to-show', async () => {
    logger.info('Main window ready to show', 'main')
    mainWindow.show()
    
    try {
      // Start proxy server when window is ready
      logger.info('Starting proxy server', 'main')
      await proxyServer.start()
      logger.info('Proxy server started successfully', 'main')
    } catch (error) {
      logger.error('Failed to start proxy server', 'main', error as Error)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Setup IPC handlers
  setupIpcHandlers(mainWindow)
}

function getOrCreatePtyManager(sessionId: string, mainWindow: BrowserWindow): PtyManager {
  if (!ptyManagers.has(sessionId)) {
    logger.info(`Creating new PTY manager for session: ${sessionId}`, 'main')
    const manager = new PtyManager(mainWindow, sessionId)
    ptyManagers.set(sessionId, manager)
  }
  return ptyManagers.get(sessionId)!
}

function setupIpcHandlers(mainWindow: BrowserWindow): void {
  // Logger IPC handlers
  ipcMain.handle('logger:log', (_, logEntry: any) => {
    logger.logFromRenderer(logEntry)
  })

  ipcMain.handle('logger:get-recent', (_, lines: number = 100) => {
    return logger.getRecentLogs(lines)
  })

  ipcMain.handle('logger:get-log-dir', () => {
    return logger.getLogDirectory()
  })

  // Terminal IPC handlers
  ipcMain.handle('terminal:input', async (_, data: string, sessionId?: string) => {
    const id = sessionId || currentActiveSessionId
    if (id) {
      const manager = getOrCreatePtyManager(id, mainWindow)
      manager.sendInput(data)
    }
  })

  ipcMain.handle('terminal:resize', async (_, cols: number, rows: number, sessionId?: string) => {
    const id = sessionId || currentActiveSessionId
    if (id) {
      const manager = getOrCreatePtyManager(id, mainWindow)
      manager.resize(cols, rows)
    }
  })

  // Project management
  ipcMain.handle('project:create', async (_, workingDirectory: string) => {
    const projectId = `new-${Date.now()}`
    dataStore.createNewProject(projectId, workingDirectory)
    logger.info(`Created new project: ${projectId} with directory: ${workingDirectory}`, 'main')
    return { id: projectId, name: path.basename(workingDirectory), path: workingDirectory }
  })

  ipcMain.handle('project:select-directory', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择项目目录',
      properties: ['openDirectory'],
      message: '请选择要作为Claude项目的工作目录'
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('project:get-all', async () => {
    try {
      const projects = dataStore.getAllProjects()
      logger.info(`Retrieved ${projects.length} projects`, 'main')
      return projects
    } catch (error) {
      logger.error('Failed to get all projects', 'main', error as Error)
      throw error
    }
  })

  // Session management
  ipcMain.handle('session:create', async (_, projectPath: string, name?: string) => {
    // For Claude sessions, we don't create sessions manually
    // Instead, we start a new Claude CLI session which will create its own session file
    const sessionId = `temp-${Date.now()}`
    currentActiveSessionId = sessionId
    
    // 确定工作目录
    let workingDirectory = projectPath
    
    // 如果传入的是项目ID而不是路径，尝试从新建项目中获取目录
    if (!path.isAbsolute(projectPath)) {
      const projectDirectory = dataStore.getProjectDirectory(projectPath)
      if (projectDirectory) {
        workingDirectory = projectDirectory
        logger.info(`Using directory for new project ${projectPath}: ${workingDirectory}`, 'main')
      } else {
        // 如果是存在的Claude项目，从项目列表中获取路径
        const allProjects = dataStore.getAllProjects()
        const project = allProjects.find(p => p.name === projectPath || p.path.includes(projectPath))
        if (project) {
          workingDirectory = project.path
          logger.info(`Using directory for existing project ${projectPath}: ${workingDirectory}`, 'main')
        } else {
          throw new Error(`Cannot find working directory for project: ${projectPath}`)
        }
      }
    }
    
    // Create PtyManager and start claude
    const manager = getOrCreatePtyManager(sessionId, mainWindow)
    await manager.start({ workingDirectory, autoStartClaude: true })
    
    logger.info(`Started new Claude session in directory: ${workingDirectory}`, 'main')
    return { id: sessionId, projectPath: workingDirectory, name: name || 'New Claude Session' }
  })

  ipcMain.handle('session:activate', async (_, sessionId: string) => {
    logger.info(`Activating session: ${sessionId}`, 'main')
    currentActiveSessionId = sessionId
    // Ensure PtyManager exists for this session
    const manager = getOrCreatePtyManager(sessionId, mainWindow)
    logger.info(`PTY manager ready for session: ${sessionId}, isRunning: ${manager.isRunning()}`, 'main')
    return true
  })

  ipcMain.handle('session:resume', async (_, sessionId: string, projectPath: string) => {
    currentActiveSessionId = sessionId
    const manager = getOrCreatePtyManager(sessionId, mainWindow)
    await manager.start({ workingDirectory: projectPath })
    
    // Find the session file path for Claude resume
    const allProjects = dataStore.getAllProjects()
    let sessionFilePath: string | undefined
    
    for (const project of allProjects) {
      const session = project.sessions.find(s => s.id === sessionId)
      if (session && session.filePath) {
        sessionFilePath = session.filePath
        break
      }
    }
    
    if (sessionFilePath) {
      // Use the actual file path for Claude resume
      manager.sendInput(`claude --resume "${sessionFilePath}"\n`)
    } else {
      // Fallback for non-Claude sessions
      manager.sendInput(`claude\n`)
    }
    
    return true
  })

  ipcMain.handle('session:delete', async (_, sessionId: string) => {
    logger.info(`Deleting session: ${sessionId}`, 'main')
    
    const manager = ptyManagers.get(sessionId)
    if (manager) {
      await manager.stop()
      ptyManagers.delete(sessionId)
    }
    if (currentActiveSessionId === sessionId) {
      currentActiveSessionId = null
    }
    
    const deletionResult = dataStore.deleteSession(sessionId)
    
    if (deletionResult.success) {
      logger.info(`Session deletion completed successfully: ${sessionId}`, 'main', { details: deletionResult.details })
    } else {
      logger.warn(`Session deletion completed with warnings: ${sessionId}`, 'main',new Error(deletionResult.error), { 
        details: deletionResult.details 
      })
    }
    
    return deletionResult
  })

  // This duplicate section has been removed - handlers are defined earlier in the file

  // Settings management
  ipcMain.handle('settings:get', () => {
    return settingsManager.getSettings()
  })

  ipcMain.handle('settings:update', (_, settings: any) => {
    settingsManager.updateSettings(settings)
    // Update proxy if needed
    if (settings.proxyConfig) {
      proxyServer.updateProxySettings()
    }
  })

  // Get current session info for status bar
  ipcMain.handle('status:get-current', () => {
    if (!currentActiveSessionId) return null
    
    // Find session in all projects
    let session: Session | undefined
    const allProjects = dataStore.getAllProjects()
    for (const project of allProjects) {
      session = project.sessions.find(s => s.id === currentActiveSessionId)
      if (session) break
    }
    
    const activeProvider = settingsManager.getActiveProvider()
    const proxyConfig = settingsManager.getProxyConfig()
    
    return {
      sessionId: currentActiveSessionId,
      projectPath: session?.projectPath || '',
      provider: activeProvider?.name || 'None',
      proxy: proxyConfig.enabled ? `${proxyConfig.host}:${proxyConfig.port}` : 'Disabled'
    }
  })
}

// App lifecycle
app.whenReady().then(() => {
  logger.info('App ready, initializing...', 'main')
  electronApp.setAppUserModelId('com.cccopilot')
  
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  logger.info('Main window created', 'main')

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  logger.info('All windows closed, cleaning up...', 'main')
  
  // Clean up PTY managers
  for (const [sessionId, manager] of ptyManagers) {
    logger.info(`Stopping PTY manager for session: ${sessionId}`, 'main')
    await manager.stop()
  }
  ptyManagers.clear()
  
  if (proxyServer) {
    logger.info('Stopping proxy server', 'main')
    await proxyServer.stop()
  }
  
  logger.info('Cleanup completed', 'main')
  
  if (process.platform !== 'darwin') app.quit()
})