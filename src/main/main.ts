import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { PtyManager } from './pty-manager'
import { SessionManager, Session } from './session-manager'
import { v4 as uuidv4 } from 'uuid';
import { SettingsManager, ClaudeAccount, ThirdPartyAccount } from './settings'
import { logger } from './logger'
import { claudePathManager } from './claude-path-manager'

// Global instances
let sessionManager: SessionManager
let settingsManager: SettingsManager

// Session-specific PtyManager cache
const ptyManagers = new Map<string, PtyManager>()
let currentActiveSessionId: string | null = null

// IPC handlers setup flag
let ipcHandlersSetup = false

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
  sessionManager = new SessionManager(settingsManager)

  // Sync with .claude directory on startup
  try {
    sessionManager.syncWithClaudeDirectory();
  } catch (error) {
    logger.error('Failed to sync with Claude directory on startup.', 'main', error as Error);
  }

  mainWindow.on('ready-to-show', async () => {
    logger.info('主窗口准备显示', 'main')
    mainWindow.show()
    
    // Initialize accounts from Claude configuration
    try {
      logger.info('初始化Claude账号信息', 'main')
      const claudeAccounts = await settingsManager.refreshClaudeAccounts()
      if (claudeAccounts.length > 0) {
        logger.info(`发现 ${claudeAccounts.length} 个Claude账号`, 'main')
        
        // 如果没有设置活动的服务提供方，自动设置为Claude官方
        if (!settingsManager.getActiveServiceProvider()) {
          settingsManager.setActiveServiceProvider('claude_official')
          logger.info('设置Claude官方作为默认服务提供方', 'main')
        }
      } else {
        logger.warn('未找到Claude账号配置', 'main')
      }
    } catch (error) {
      logger.error('初始化Claude账号失败', 'main', error as Error)
    }
    

    // Initialize Claude path manager first
    try {
      logger.info('初始化Claude路径管理器', 'main')
      await claudePathManager.detectClaudePath()
      logger.info('Claude路径管理器初始化完成', 'main')
    } catch (error) {
      logger.error('Claude路径管理器初始化失败', 'main', error as Error)
    }

    // Start Claude detection (now handled by path manager initialization above)
    try {
      const pathResult = claudePathManager.getCachedResult()
      if (pathResult) {
        // 转换为旧的接口格式以保持兼容性
        const detectionResult = {
          isInstalled: pathResult.isFound,
          version: pathResult.version,
          path: pathResult.path,
          error: pathResult.error,
          timestamp: pathResult.timestamp
        }
        
        if (pathResult.isFound) {
          logger.info(`Claude CLI检测成功: ${pathResult.version}`, 'main')
        } else {
          logger.warn(`Claude CLI未找到: ${pathResult.error}`, 'main')
        }
        
        // Notify renderer about detection result
        mainWindow.webContents.send('claude:detection-result', detectionResult)
      }
    } catch (error) {
      logger.error('获取Claude CLI检测结果失败', 'main', error as Error)
      // Send failure result to renderer
      const failureResult = {
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

  // Setup IPC handlers (only once)
  if (!ipcHandlersSetup) {
    setupIpcHandlers(mainWindow)
    ipcHandlersSetup = true
  }
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
      logger.info(`临时会话 ${sessionId} 已关联到 Claude 会话: ${claudeSessionId}`, 'main');
      mainWindow.webContents.send('session:updated', { oldId: sessionId, newSession: updatedSession });
    }
  };

  const manager = new PtyManager(mainWindow, sessionId, onSessionReady);
  ptyManagers.set(sessionId, manager);
  return manager;
}

// Claude账号authorization检测函数
async function detectClaudeAuthorization(accountEmail: string): Promise<{ success: boolean, error?: string }> {
  try {
    // 查找指定的Claude官方账号
    const providers = settingsManager.getServiceProviders()
    const claudeProvider = providers.find(p => p.type === 'claude_official')
    if (!claudeProvider) {
      const error = '未找到Claude官方服务提供方'
      logger.warn(`检测失败: ${error}`, 'main')
      return { success: false, error }
    }

    const targetAccount = claudeProvider.accounts.find(
      (acc) => (acc as ClaudeAccount).emailAddress === accountEmail
    ) as ClaudeAccount | undefined

    if (!targetAccount) {
      const error = `未找到账号: ${accountEmail}`
      logger.warn(`检测失败: ${error}`, 'main')
      return { success: false, error }
    }

    logger.info(`开始检测Claude账号 ${targetAccount.emailAddress} 的authorization值`, 'main')
    
    // 检查是否已经有authorization值
    if (targetAccount.authorization) {
      logger.info(`账号 ${targetAccount.emailAddress} 已有authorization值`, 'main')
      return { success: true }
    }
    
    // 保存当前活动账号，以便检测完成后恢复
    const originalActiveResult = settingsManager.getCurrentActiveAccount()
    let needRestoreAccount = false
    
    // 临时切换到目标账号进行检测
    if (!originalActiveResult || 
        originalActiveResult.provider.id !== claudeProvider.id || 
        (originalActiveResult.account as ClaudeAccount).emailAddress !== accountEmail) {
      logger.info(`临时切换到账号 ${accountEmail} 进行检测`, 'main')
      settingsManager.setActiveServiceProvider(claudeProvider.id)
      settingsManager.setActiveAccount(claudeProvider.id, targetAccount.accountUuid)
      needRestoreAccount = true
    }
    
    // 选择一个已有的非临时会话作为检测的工作目录
    const allSessions = sessionManager.getAllSessions()
    const nonTempSession = allSessions.find(s => !s.isTemporary)
    
    let detectDir: string
    let useExistingSession = false
    let existingSessionId: string | null = null
    let originalActiveSessionId = currentActiveSessionId
    
    if (nonTempSession) {
      // 使用已有会话的项目目录
      const project = sessionManager.getProjectById(nonTempSession.projectId)
      if (project && fs.existsSync(project.path)) {
        detectDir = project.path
        useExistingSession = true
        existingSessionId = nonTempSession.id
        logger.info(`使用已有会话 ${nonTempSession.id} 的工作目录进行检测: ${detectDir}`, 'main')
        
        // 临时激活这个会话进行检测 - 直接调用激活逻辑
        logger.info(`临时激活会话 ${nonTempSession.id} 进行检测`, 'main')
        
        // 使用与 session:activate 完全相同的逻辑
        currentActiveSessionId = nonTempSession.id
        const ptyManager = getOrCreatePtyManager(nonTempSession.id, BrowserWindow.getFocusedWindow()!)
        if (!ptyManager.isRunning()) {
          const claudeArgs = []
          if (nonTempSession.claudeSessionId) {
            claudeArgs.push('--resume', nonTempSession.claudeSessionId)
            logger.info(`使用resume参数恢复Claude会话: ${nonTempSession.claudeSessionId}`, 'main')
          }

          await ptyManager.start({
            workingDirectory: detectDir,
            args: claudeArgs,
          })
          logger.info(`会话已激活进行检测: ${nonTempSession.id}`, 'main')
        } else {
          logger.info(`使用已运行的会话进行检测: ${nonTempSession.id}`, 'main')
        }
      } else {
        // 备用方案：使用用户主目录
        const homeDir = os.homedir()
        detectDir = path.join(homeDir, '.claude-auth-detect')
        if (!fs.existsSync(detectDir)) {
          fs.mkdirSync(detectDir, { recursive: true })
        }
        logger.info(`未找到有效的项目目录，使用备用检测目录: ${detectDir}`, 'main')
      }
    } else {
      // 备用方案：没有非临时会话时使用专用检测目录
      const homeDir = os.homedir()
      detectDir = path.join(homeDir, '.claude-auth-detect')
      if (!fs.existsSync(detectDir)) {
        fs.mkdirSync(detectDir, { recursive: true })
      }
      logger.info(`未找到非临时会话，使用专用检测目录: ${detectDir}`, 'main')
    }
    
    const tempSessionId = useExistingSession ? existingSessionId! : `detect-${Date.now()}`
    
    logger.info(`检测会话ID: ${tempSessionId}`, 'main')
    logger.info(`使用检测目录: ${detectDir}`, 'main')
    
    // 如果没有使用已有会话，创建临时PTY管理器并启动
    if (!useExistingSession) {
      const detectionPtyManager = new PtyManager(BrowserWindow.getFocusedWindow()!, tempSessionId)
      logger.info(`创建新的临时PTY管理器: ${tempSessionId}`, 'main')
      
      try {
        // 启动Claude CLI进行检测
        await detectionPtyManager.start({
          workingDirectory: detectDir,
          args: [],
        })
        
        logger.info('临时Claude CLI检测会话已启动，开始监控authorization值', 'main')
      } catch (error) {
        logger.error('启动临时检测会话失败', 'main', error as Error)
        throw error
      }
    } else {
      logger.info('已有会话已激活，开始监控authorization值', 'main')
    }
    
    try {
      
      return new Promise((resolve) => {
        let checkCount = 0
        const maxChecks = 8 // 最多检查8次，每次间隔2秒 = 16秒超时
        
        const checkInterval = setInterval(() => {
          checkCount++
          
          // 重新获取账号信息检查authorization值
          const providers = settingsManager.getServiceProviders()
          const claudeProvider = providers.find(p => p.type === 'claude_official')
          const updatedAccount = claudeProvider?.accounts.find(
            (acc) => (acc as ClaudeAccount).emailAddress === targetAccount.emailAddress
          ) as ClaudeAccount | undefined
          
          if (updatedAccount?.authorization) {
            clearInterval(checkInterval)
            
            logger.info(`成功检测到Claude账号 ${targetAccount.emailAddress} 的authorization值`, 'main')
            
            // 停止检测会话（如果是临时创建的）
            let stopPromise = Promise.resolve()
            if (!useExistingSession) {
              // 获取临时PTY管理器并停止
              const tempPtyManager = ptyManagers.get(tempSessionId)
              if (tempPtyManager) {
                stopPromise = Promise.resolve().then(async () => {
                  tempPtyManager.destroy()
                  await tempPtyManager.stop()
                  ptyManagers.delete(tempSessionId)
                })
              }
            }
            stopPromise.then(async () => {
              
              // 恢复原来的活动会话
              if (originalActiveSessionId && originalActiveSessionId !== tempSessionId) {
                currentActiveSessionId = originalActiveSessionId
                logger.info(`恢复原来的活动会话: ${originalActiveSessionId}`, 'main')
              }
              
              // 恢复原来的活动账号
              if (needRestoreAccount && originalActiveResult) {
                logger.info('恢复原来的活动账号', 'main')
                settingsManager.setActiveAccount(originalActiveResult.provider.id, 
                  originalActiveResult.provider.type === 'claude_official' 
                    ? (originalActiveResult.account as ClaudeAccount).accountUuid
                    : (originalActiveResult.account as ThirdPartyAccount).id
                )
              }
            })
            
            resolve({ success: true })
          } else if (checkCount >= maxChecks) {
            clearInterval(checkInterval)
            
            logger.warn(`检测超时（${maxChecks * 2}秒），未获取到authorization值`, 'main')
            
            // 停止检测会话（如果是临时创建的）
            let stopPromise = Promise.resolve()
            if (!useExistingSession) {
              // 获取临时PTY管理器并停止
              const tempPtyManager = ptyManagers.get(tempSessionId)
              if (tempPtyManager) {
                stopPromise = Promise.resolve().then(async () => {
                  tempPtyManager.destroy()
                  await tempPtyManager.stop()
                  ptyManagers.delete(tempSessionId)
                })
              }
            }
            stopPromise.then(async () => {
              
              // 恢复原来的活动会话
              if (originalActiveSessionId && originalActiveSessionId !== tempSessionId) {
                currentActiveSessionId = originalActiveSessionId
                logger.info(`恢复原来的活动会话: ${originalActiveSessionId}`, 'main')
              }
              
              // 恢复原来的活动账号
              if (needRestoreAccount && originalActiveResult) {
                logger.info('恢复原来的活动账号', 'main')
                settingsManager.setActiveServiceProvider(originalActiveResult.provider.id)
                settingsManager.setActiveAccount(originalActiveResult.provider.id, 
                  originalActiveResult.provider.type === 'claude_official' 
                    ? (originalActiveResult.account as ClaudeAccount).accountUuid
                    : (originalActiveResult.account as ThirdPartyAccount).id
                )
              }
            })
            
            resolve({ 
              success: false, 
              error: `检测超时（${maxChecks * 2}秒），未获取到authorization值` 
            })
          } else {
            logger.debug(`第 ${checkCount} 次检查，尚未获取到authorization值`, 'main')
          }
        }, 2000) // 每2秒检查一次
      })
      
    } catch (error) {
      logger.error('启动检测会话失败', 'main', error as Error)
      
      // 清理临时PTY管理器（如果存在）
      if (!useExistingSession) {
        const tempPtyManager = ptyManagers.get(tempSessionId)
        if (tempPtyManager) {
          tempPtyManager.destroy()
          await tempPtyManager.stop()
          ptyManagers.delete(tempSessionId)
        }
      }
      
      // 恢复原来的活动会话
      if (originalActiveSessionId && originalActiveSessionId !== tempSessionId) {
        currentActiveSessionId = originalActiveSessionId
        logger.info(`恢复原来的活动会话: ${originalActiveSessionId}`, 'main')
      }
      
      // 恢复原来的活动账号
      if (needRestoreAccount && originalActiveResult) {
        logger.info('恢复原来的活动账号', 'main')
        settingsManager.setActiveServiceProvider(originalActiveResult.provider.id)
        settingsManager.setActiveAccount(originalActiveResult.provider.id, 
          originalActiveResult.provider.type === 'claude_official' 
            ? (originalActiveResult.account as ClaudeAccount).accountUuid
            :(originalActiveResult.account as ThirdPartyAccount).id
        )
      }
      
      return { 
        success: false, 
        error: `启动Claude CLI检测失败: ${(error as Error).message}` 
      }
    }
    
  } catch (error) {
    logger.error('检测authorization过程中出错', 'main', error as Error)
    return { 
      success: false, 
      error: `检测过程中出错: ${(error as Error).message}` 
    }
  }
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

  ipcMain.handle('terminal:send-system-message', async (_, message: string, sessionId?: string) => {
    const id = sessionId || currentActiveSessionId
    if (id && mainWindow && !mainWindow.isDestroyed()) {
      try {
        // Format message with ANSI colors and proper line breaks
        const formattedMessage = `\r\n${message}\r\n`
        mainWindow.webContents.send('terminal:data', {
          sessionId: id,
          data: formattedMessage
        })
      } catch (error) {
        logger.warn(`无法发送系统消息到终端: ${(error as Error).message}`, 'main')
      }
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

    logger.info(`为项目 ${project.name} 创建新会话，工作目录: ${project.path}`, 'main');
    
    // Create a temporary session for UI display
    const newSession: Session = {
      id: `sess-${Date.now()}`,
      name: 'New Session',
      projectId: projectId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isTemporary: true, // Will be updated when Claude CLI creates the real session
    };
    sessionManager.addSession(newSession);

    // Immediately start Claude CLI for this session
    currentActiveSessionId = newSession.id;
    const ptyManager = getOrCreatePtyManager(newSession.id, mainWindow);
    
    try {
      await ptyManager.start({
        workingDirectory: project.path,
        args: [], // No resume args since this is a new session
      });
      
      logger.info(`Claude CLI已启动，会话: ${newSession.id}，工作目录: ${project.path}`, 'main');
    } catch (error) {
      logger.error(`启动Claude CLI失败，会话: ${newSession.id}`, 'main', error as Error);
      // Still send the session to UI even if Claude CLI failed to start
    }

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
    const pathResult = claudePathManager.getCachedResult()
    const result = pathResult ? {
      isInstalled: pathResult.isFound,
      version: pathResult.version,
      path: pathResult.path,
      error: pathResult.error,
      timestamp: pathResult.timestamp
    } : null
    logger.info('获取Claude检测结果', 'main', {result:result})
    return result
  })

  ipcMain.handle('claude:redetect', async () => {
    try {
      logger.info('重新检测Claude CLI', 'main')
      const pathResult = await claudePathManager.detectClaudePath(true) // 强制重新检测
      
      // 转换为旧的接口格式以保持兼容性
      const result = {
        isInstalled: pathResult.isFound,
        version: pathResult.version,
        path: pathResult.path,
        error: pathResult.error,
        timestamp: pathResult.timestamp
      }
      
      // Notify all windows about new detection result
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('claude:detection-result', result)
      })
      
      return result
    } catch (error) {
      logger.error('重新检测Claude CLI失败', 'main', error as Error)
      const failureResult = {
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
    const pathResult = claudePathManager.getCachedResult()
    return pathResult?.isFound === true
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
      try {
        manager.destroy();
        await manager.stop();
      } catch (error) {
        logger.error(`停止PTY管理器失败: ${sessionId}`, 'main', error as Error);
      }
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

  ipcMain.handle('settings:update', async (_, settings: any) => {
    settingsManager.updateSettings(settings)
    // If project filter settings changed, trigger a resync
    if (settings.projectFilter) {
      try {
        sessionManager.syncWithClaudeDirectory()
        // Notify renderer about updated projects
        const projects = sessionManager.getProjects()
        const sessions = sessionManager.getAllSessions()
        const projectsWithSessions = projects.map(p => ({
          ...p,
          sessions: sessions
            .filter(s => s.projectId === p.id)
            .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
        }))
        mainWindow.webContents.send('projects:updated', projectsWithSessions)
      } catch (error) {
        logger.error('重新同步项目失败', 'main', error as Error)
      }
    }
  })

  ipcMain.handle('settings:get-project-filter', () => {
    return settingsManager.getProjectFilterConfig()
  })

  ipcMain.handle('settings:update-project-filter', (_, config: any) => {
    settingsManager.updateProjectFilterConfig(config)
    // Trigger a resync to apply the new filter
    try {
      sessionManager.syncWithClaudeDirectory()
      // Notify renderer about updated projects
      const projects = sessionManager.getProjects()
      const sessions = sessionManager.getAllSessions()
      const projectsWithSessions = projects.map(p => ({
        ...p,
        sessions: sessions
          .filter(s => s.projectId === p.id)
          .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
      }))
      mainWindow.webContents.send('projects:updated', projectsWithSessions)
    } catch (error) {
      logger.error('应用项目过滤器失败', 'main', error as Error)
      throw error
    }
  })

  // Account management
  ipcMain.handle('accounts:get-service-providers', () => {
    return settingsManager.getServiceProviders()
  })

  ipcMain.handle('accounts:get-active-provider', () => {
    return settingsManager.getCurrentActiveAccount()
  })

  ipcMain.handle('accounts:set-active-provider', async (_, providerId: string) => {
    settingsManager.setActiveServiceProvider(providerId)
  })

  ipcMain.handle('accounts:set-active-account', async (_, providerId: string, accountId: string) => {
    settingsManager.setActiveAccount(providerId, accountId)
  })

  ipcMain.handle('accounts:refresh-claude-accounts', async () => {
    try {
      return await settingsManager.refreshClaudeAccounts()
    } catch (error) {
      logger.error('刷新Claude账号失败', 'main', error as Error)
      throw error
    }
  })

  ipcMain.handle('accounts:add-third-party', (_, providerId: string, account: any) => {
    settingsManager.addThirdPartyAccount(providerId, account)
  })

  ipcMain.handle('accounts:remove-third-party', (_, providerId: string, accountId: string) => {
    settingsManager.removeThirdPartyAccount(providerId, accountId)
  })

  ipcMain.handle('accounts:set-provider-proxy', async (_, providerId: string, useProxy: boolean) => {
    settingsManager.setProviderProxyUsage(providerId, useProxy)
  })

  ipcMain.handle('accounts:detect-claude-authorization', async (_, accountEmail: string) => {
    try {
      logger.info(`开始检测Claude账号 ${accountEmail} 的authorization`, 'main')
      const result = await detectClaudeAuthorization(accountEmail)
      logger.info(`检测Claude authorization结果: ${result.success ? '成功' : '失败'}`, 'main')
      return result
    } catch (error) {
      logger.error('检测Claude authorization失败', 'main', error as Error)
      return { success: false, error: `检测失败: ${(error as Error).message}` }
    }
  })

  // Settings event forwarding to renderer
  settingsManager.on('service-providers:updated', (providers) => {
    mainWindow.webContents.send('service-providers:updated', providers)
  })
  
  settingsManager.on('active-service-provider:changed', (providerId) => {
    mainWindow.webContents.send('active-service-provider:changed', providerId)
  })
  
  settingsManager.on('active-account:changed', (data) => {
    mainWindow.webContents.send('active-account:changed', data)
  })
  
  settingsManager.on('settings:updated', (settings) => {
    mainWindow.webContents.send('settings:updated', settings)
  })

  // Get current session info for status bar
  ipcMain.handle('status:get-current', () => {
    if (!currentActiveSessionId) return null;

    const session = sessionManager.getSessionById(currentActiveSessionId);
    if (!session) return null;

    const project = sessionManager.getProjectById(session.projectId);

    // 直接从settings manager获取状态信息
    const activeResult = settingsManager.getCurrentActiveAccount();
    const proxyConfig = settingsManager.getProxyConfig();
    const shouldUseProxy = settingsManager.shouldUseProxyForCurrentProvider();

    let provider = 'None';
    let account = 'None';
    let target = 'Unknown';

    if (activeResult) {
      provider = activeResult.provider.name;
      if (activeResult.provider.type === 'claude_official') {
        account = (activeResult.account as any).emailAddress;
        target = 'api.anthropic.com';
      } else {
        account = (activeResult.account as ThirdPartyAccount).name;
        target = (activeResult.account as ThirdPartyAccount).baseUrl;
      }
    }

    const proxyEnabled = proxyConfig.enabled && shouldUseProxy;

    return {
      sessionId: currentActiveSessionId,
      projectPath: project?.path || '',
      provider,
      account, 
      proxy: proxyEnabled ? proxyConfig.url : 'Disabled',
      target
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
    try {
      // First destroy to prevent further IPC communication
      manager.destroy()
      // Then stop the process
      await manager.stop()
    } catch (error) {
      logger.error(`清理PTY管理器失败: ${sessionId}`, 'main', error as Error)
    }
  }
  ptyManagers.clear()
  
  logger.info('清理完成', 'main')
  
  if (process.platform !== 'darwin') app.quit()
})