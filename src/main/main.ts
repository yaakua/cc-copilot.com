import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import * as path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ProxyServer } from './proxy'
import { PtyManager } from './pty-manager'
import { DataStore, Session } from './store'
import { SettingsManager } from './settings'
import { logger } from './logger'
import { claudeDetector, ClaudeDetectionResult } from './claude-detector'

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
    logger.info('主窗口准备显示', 'main')
    mainWindow.show()
    
    try {
      // Start proxy server when window is ready
      logger.info('启动代理服务器', 'main')
      await proxyServer.start()
      logger.info('代理服务器启动成功', 'main')
    } catch (error) {
      logger.error('启动代理服务器失败', 'main', error as Error)
    }

    // Start Claude detection
    try {
      logger.info('开始Claude CLI检测', 'main')
      const result = await claudeDetector.detect()
      if (result.isInstalled) {
        logger.info(`Claude CLI检测成功: ${result.version}`, 'main')
      } else {
        logger.warn(`Claude CLI未找到: ${result.error}`, 'main')
      }
      
      // Notify renderer about detection result
      mainWindow.webContents.send('claude:detection-result', result)
    } catch (error) {
      logger.error('Claude CLI检测失败', 'main', error as Error)
      // Send failure result to renderer
      const failureResult: ClaudeDetectionResult = {
        isInstalled: false,
        error: `检测失败: ${(error as Error).message}`,
        timestamp: Date.now()
      }
      mainWindow.webContents.send('claude:detection-result', failureResult)
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
    logger.info(`为会话创建新的PTY管理器: ${sessionId}`, 'main')
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
    logger.info(`创建新项目: ${projectId}，目录: ${workingDirectory}`, 'main')
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
      logger.info(`获取到 ${projects.length} 个项目`, 'main')
      return projects
    } catch (error) {
      logger.error('获取所有项目失败', 'main', error as Error)
      throw error
    }
  })

  // Claude detection management
  ipcMain.handle('claude:get-detection-result', async () => {
    const result = claudeDetector.getLastResult()
    logger.info('获取Claude检测结果', 'main', {result:result})
    return result
  })

  ipcMain.handle('claude:redetect', async () => {
    try {
      logger.info('重新检测Claude CLI', 'main')
      const result = await claudeDetector.detect(true) // 强制重新检测
      
      // Notify all windows about new detection result
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('claude:detection-result', result)
      })
      
      return result
    } catch (error) {
      logger.error('重新检测Claude CLI失败', 'main', error as Error)
      const failureResult: ClaudeDetectionResult = {
        isInstalled: false,
        error: `重新检测失败: ${(error as Error).message}`,
        timestamp: Date.now()
      }
      
      // Notify all windows about failure
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('claude:detection-result', failureResult)
      })
      
      return failureResult
    }
  })

  ipcMain.handle('claude:is-available', async () => {
    return claudeDetector.isClaudeAvailable()
  })

  // Session management
  ipcMain.handle('session:create', async (_, projectPath: string, name?: string) => {
    // Check if Claude is available before creating session
    if (!claudeDetector.isClaudeAvailable()) {
      const result = claudeDetector.getLastResult()
      const errorMessage = result?.error || 'Claude CLI 未检测到'
      logger.error('无法创建会话 - Claude CLI不可用', 'main', new Error(errorMessage))
      throw new Error(`无法创建会话: ${errorMessage}. 请确保已安装Claude CLI并重新检测。`)
    }

    // 确定工作目录
    let workingDirectory = projectPath
    
    // 如果传入的是项目ID而不是路径，尝试从新建项目中获取目录
    if (!path.isAbsolute(projectPath)) {
      const projectDirectory = dataStore.getProjectDirectory(projectPath)
      if (projectDirectory) {
        workingDirectory = projectDirectory
        logger.info(`为新项目使用目录 ${projectPath}: ${workingDirectory}`, 'main')
      } else {
        // 如果是存在的Claude项目，从项目列表中获取路径
        const allProjects = dataStore.getAllProjects()
        const project = allProjects.find(p => p.name === projectPath || p.path.includes(projectPath))
        if (project) {
          workingDirectory = project.path
          logger.info(`为现有项目使用目录 ${projectPath}: ${workingDirectory}`, 'main')
        } else {
          throw new Error(`Cannot find working directory for project: ${projectPath}`)
        }
      }
    }
    
    // Start Claude session and wait for it to create a real session file
    // Use a temporary sessionId initially, which will be replaced with the real one
    const tempSessionId = `temp-${Date.now()}`
    currentActiveSessionId = tempSessionId
    
    // Create PtyManager and start claude - start() will wait for shell to be ready
    const manager = getOrCreatePtyManager(tempSessionId, mainWindow)
    await manager.start({ workingDirectory, autoStartClaude: true, args: ['-c'] })
    
    logger.info(`Claude会话在目录中准备就绪: ${workingDirectory}`, 'main')

    // Setup session monitoring for when Claude creates a real session file
    const checkForRealSession = () => {
      const projects = dataStore.getAllProjects()
      for (const project of projects) {
        if (project.path === workingDirectory) {
          // Find the newest session that wasn't there before
          const newestSession = project.sessions[0] // Sessions are sorted by modification time
          if (newestSession && newestSession.id !== tempSessionId) {
            // Found a real Claude session - replace the temporary one
            logger.info(`检测到真实Claude会话: ${newestSession.id}, 替换临时会话: ${tempSessionId}`, 'main')
            
            // Update active session ID
            currentActiveSessionId = newestSession.id
            
            // Move PTY manager to real session ID
            ptyManagers.set(newestSession.id, manager)
            ptyManagers.delete(tempSessionId)
            
            // Notify renderer of session ID change
            mainWindow.webContents.send('session:updated', {
              oldId: tempSessionId,
              newSession: {
                id: newestSession.id,
                projectPath: workingDirectory,
                name: newestSession.name
              }
            })
            
            return true
          }
        }
      }
      return false
    }

    // Check immediately and then periodically for a real session
    if (!checkForRealSession()) {
      const checkInterval = setInterval(() => {
        if (checkForRealSession()) {
          clearInterval(checkInterval)
        }
      }, 1000) // Check every second
      
      // Stop checking after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
      }, 30000)
    }

    const newSession = { id: tempSessionId, projectPath: workingDirectory, name: name || 'New Claude Session' };

    // Notify the renderer process that a new session has been created and is active
    mainWindow.webContents.send('session:created', newSession);

    return newSession;
  })

  ipcMain.handle('session:activate', async (_, sessionId: string) => {
    logger.info(`激活会话: ${sessionId}`, 'main')
    currentActiveSessionId = sessionId
    // Ensure PtyManager exists for this session
    const manager = getOrCreatePtyManager(sessionId, mainWindow)
    logger.info(`PTY manager ready for session: ${sessionId}, isRunning: ${manager.isRunning()}`, 'main')
    return true
  })

  ipcMain.handle('session:resume', async (_, sessionId: string, projectPath: string) => {
    currentActiveSessionId = sessionId
    const manager = getOrCreatePtyManager(sessionId, mainWindow)
    await manager.start({ workingDirectory: projectPath, autoStartClaude: true , args: ['-r',sessionId]})
    return true
  })

  ipcMain.handle('session:delete', async (_, sessionId: string) => {
    logger.info(`删除会话: ${sessionId}`, 'main')
    
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
      logger.info(`会话删除成功完成: ${sessionId}`, 'main', { details: deletionResult.details })
    } else {
      logger.warn(`会话删除完成但有警告: ${sessionId}`, 'main',new Error(deletionResult.error), { 
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
  logger.info('应用程序准备就绪，正在初始化...', 'main')
  electronApp.setAppUserModelId('com.cccopilot')
  
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  logger.info('主窗口已创建', 'main')

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  logger.info('所有窗口已关闭，正在清理...', 'main')
  
  // Clean up PTY managers
  for (const [sessionId, manager] of ptyManagers) {
    logger.info(`停止会话的PTY管理器: ${sessionId}`, 'main')
    await manager.stop()
  }
  ptyManagers.clear()
  
  if (proxyServer) {
    logger.info('停止代理服务器', 'main')
    await proxyServer.stop()
  }
  
  logger.info('清理完成', 'main')
  
  if (process.platform !== 'darwin') app.quit()
})