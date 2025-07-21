import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import * as path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ProxyServer } from './proxy'
import { PtyManager } from './pty-manager'
import { SessionManager, Session, Project } from './session-manager'
import { v4 as uuidv4 } from 'uuid';
import { SettingsManager } from './settings'
import { logger } from './logger'
import { claudeDetector, ClaudeDetectionResult } from './claude-detector'

// Global instances
let proxyServer: ProxyServer
let sessionManager: SessionManager
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
  sessionManager = new SessionManager()
  proxyServer = new ProxyServer(settingsManager)

  // Sync with .claude directory on startup
  try {
    sessionManager.syncWithClaudeDirectory();
  } catch (error) {
    logger.error('Failed to sync with Claude directory on startup.', 'main', error as Error);
  }

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
  if (ptyManagers.has(sessionId)) {
    return ptyManagers.get(sessionId)!;
  }

  logger.info(`为会话创建新的PTY管理器: ${sessionId}`, 'main');

  const onSessionReady = (claudeSessionId: string) => {
    logger.info(`会话 ${sessionId} 已就绪, Claude 会话 ID: ${claudeSessionId}`, 'main');
    const updatedSession = sessionManager.updateSession(sessionId, {
      claudeSessionId: claudeSessionId,
      isTemporary: false,
      lastActiveAt: new Date().toISOString(),
    });

    if (updatedSession) {
      mainWindow.webContents.send('session:updated', { oldId: sessionId, newSession: updatedSession });
    }
  };

  const manager = new PtyManager(mainWindow, sessionId, onSessionReady);
  ptyManagers.set(sessionId, manager);
  return manager;
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
  ipcMain.handle('project:create', async (_, projectPath: string) => {
    let project = sessionManager.getProjects().find(p => p.path === projectPath);
    if (!project) {
        project = {
        id: uuidv4(),
        name: path.basename(projectPath),
        path: projectPath,
        createdAt: new Date().toISOString(),
      };
      sessionManager.addProject(project);
      mainWindow.webContents.send('project:created', project);
    }

    // This will now be handled by createSession
    // const newSession = await sessionManager.createSession(project.id);
    // logger.info(`创建新项目和会话: ${project.name}`, 'main');
    // mainWindow.webContents.send('session:created', newSession);
    
    return { project };
  });

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
      const projects = sessionManager.getProjects();
      const sessions = sessionManager.getAllSessions();

      const projectsWithSessions = projects.map(p => ({
        ...p,
        sessions: sessions
          .filter(s => s.projectId === p.id)
          .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
      }));

      logger.info(`获取到 ${projectsWithSessions.length} 个项目`, 'main');
      return projectsWithSessions;
    } catch (error) {
      logger.error('获取所有项目失败', 'main', error as Error);
      return [];
    }
  });

  // Session management
  ipcMain.handle('session:create', async (_, projectId: string) => {
    const project = sessionManager.getProjectById(projectId);
    if (!project) {
      logger.error(`创建会话失败: 未找到项目 ${projectId}`, 'main');
      return null;
    }

    const newSession: Session = {
      id: `sess-${Date.now()}`,
      name: 'New Session',
      projectId: projectId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isTemporary: true,
      claudeSessionId: `temp-${Date.now()}`,
      filePath: '',
    };
    sessionManager.addSession(newSession);

    logger.info(`在项目 ${project.name} 中创建新会话`, 'main');
    mainWindow.webContents.send('session:created', newSession);

    return newSession;
  });

  ipcMain.handle('session:activate', async (_, sessionId: string) => {
    currentActiveSessionId = sessionId;
    const session = sessionManager.getSessionById(sessionId);
    if (!session) {
      logger.error(`激活会话失败: 未找到会话 ${sessionId}`, 'main');
      return;
    }

    const project = sessionManager.getProjectById(session.projectId);
    if (!project) {
      logger.error(`激活会话失败: 未找到项目 ${session.projectId}`, 'main');
      return;
    }

    const ptyManager = getOrCreatePtyManager(sessionId, mainWindow);
    if (!ptyManager.isRunning()) {
      const claudeArgs = [];
      if (session.claudeSessionId) {
        claudeArgs.push('--resume', session.claudeSessionId);
      }

      await ptyManager.start({
        workingDirectory: project.path,
        args: claudeArgs,
      });
    }
    logger.info(`会话已激活: ${sessionId}`, 'main');
  });

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





  ipcMain.handle('session:resume', async (_, sessionId: string, projectPath: string) => {
    currentActiveSessionId = sessionId
    const manager = getOrCreatePtyManager(sessionId, mainWindow)
    await manager.start({ workingDirectory: projectPath, autoStartClaude: true , args: ['-r',sessionId]})
    return true
  })

  ipcMain.handle('session:delete', async (_, sessionId: string) => {
    logger.info(`删除会话: ${sessionId}`, 'main');

    const manager = ptyManagers.get(sessionId);
    if (manager) {
      await manager.stop();
      ptyManagers.delete(sessionId);
    }
    if (currentActiveSessionId === sessionId) {
      currentActiveSessionId = null;
    }

    sessionManager.deleteSession(sessionId);
    logger.info(`会话已从SessionManager中删除: ${sessionId}`, 'main');

    mainWindow.webContents.send('session:deleted', sessionId);

    return { success: true };
  });

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
    if (!currentActiveSessionId) return null;

    const session = sessionManager.getSessionById(currentActiveSessionId);
    if (!session) return null;

    const project = sessionManager.getProjectById(session.projectId);

    const activeProvider = settingsManager.getActiveProvider();
    const proxyConfig = settingsManager.getProxyConfig();

    return {
      sessionId: currentActiveSessionId,
      projectPath: project?.path || '',
      provider: activeProvider?.name || 'None',
      proxy: proxyConfig.enabled ? `${proxyConfig.host}:${proxyConfig.port}` : 'Disabled'
    };
  });
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