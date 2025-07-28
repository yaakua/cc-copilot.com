import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import * as os from 'os'
import * as fs from 'fs'
import { logger } from './logger'
import path from 'path'
import { claudePathManager } from './claude-path-manager'
import { ClaudeChannelInfo } from '../shared/types'

export interface PtyOptions {
  workingDirectory?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
  autoStartClaude?: boolean
  args?: string[]
}

export class PtyManager {
  private onSessionReady: ((claudeSessionId: string) => void) | null = null;
  private onProcessExit: ((sessionId: string, exitCode: number, signal?: string) => void) | null = null;
  private ptyProcess: pty.IPty | null = null
  private mainWindow: BrowserWindow | null = null
  private currentEnv: Record<string, string | undefined> = {}
  private sessionId: string
  private lastInterceptorScript: string = ''
  private lastClaudeCommand: string = ''
  private lastWorkingDirectory: string = ''
  private lastArgs: string[] = []
  private isDestroyed: boolean = false
  private sessionReadyTimeout: NodeJS.Timeout | null = null
  private hasDetectedClaudePrompt: boolean = false
  private startTime: number = 0
  private allOutputBuffer: string = '' // 完整输出缓冲区用于调试

  constructor(
    mainWindow: BrowserWindow,
    sessionId: string,
    onSessionReadyCallback?: (claudeSessionId: string) => void,
    onProcessExitCallback?: (sessionId: string, exitCode: number, signal?: string) => void
  ) {
    this.mainWindow = mainWindow;
    this.sessionId = sessionId;
    this.currentEnv = { ...process.env };

    if (onSessionReadyCallback) {
      this.onSessionReady = onSessionReadyCallback;
    }
    
    if (onProcessExitCallback) {
      this.onProcessExit = onProcessExitCallback;
    }
  }

  public async start(options: PtyOptions = {}): Promise<void> {
    if (this.ptyProcess) {
      logger.info('进程已在运行', 'pty-manager')
      return
    }

    try {
      logger.info('启动专用 Claude 进程...', 'pty-manager')

      const {
        workingDirectory,
        env = {},
        cols = 80,
        rows = 24,
        autoStartClaude = true
      } = options

      if (!autoStartClaude) {
        throw new Error('PtyManager is now specialized for Claude. autoStartClaude must be true.')
      }

      if (!workingDirectory) {
        throw new Error('Working directory is required when starting PTY process')
      }

      try {
        fs.accessSync(workingDirectory, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK)
        logger.info(`工作目录验证成功: ${workingDirectory}`, 'pty-manager')
      } catch (error) {
        logger.error(`工作目录验证失败: ${workingDirectory}`, 'pty-manager', error as Error)
        throw new Error(`Invalid working directory: ${workingDirectory} - ${(error as Error).message}`)
      }

      // ==========================================================
      // ===== 核心改动：获取并合并完整的 Shell 环境 ==============
      // ==========================================================

      // 异步获取用户登录 shell 的 PATH
      let userShellPath: string;
      try {
        // 使用动态导入来加载 ES 模块
        //@ts-ignore
        const { shellPath } = await import('shell-path');
        userShellPath = await shellPath();
        logger.info(`成功获取用户 Shell PATH: ${userShellPath}`, 'pty-manager');
      } catch (error) {
        logger.warn(`获取Shell PATH失败，使用当前进程PATH: ${error}`, 'pty-manager');
        userShellPath = process.env.PATH || '';
      }

      const mergedEnv = {
        ...this.currentEnv, // 这是 Electron 进程的基础 env
        ...env,             // 这是从 options 传入的自定义 env
        CLAUDE_PROJECT_DIR: workingDirectory,
        // 关键一步：使用完整的 Shell PATH 覆盖/增强现有的 PATH
        // 我们将它放在前面，以确保用户自定义的路径（如 Homebrew, nvm, bun）优先被搜索
        PATH: userShellPath ? `${userShellPath}:${process.env.PATH || ''}` : process.env.PATH,
        // 确保 HOME 目录也被正确设置，很多 CLI 工具依赖它
        HOME: os.homedir(),
      };

      // 记录关键环境变量以便调试
      logger.info(`环境变量设置: CLAUDE_PROJECT_DIR=${mergedEnv.CLAUDE_PROJECT_DIR}`, 'pty-manager')
      logger.debug(`合并后的完整 PATH: ${mergedEnv.PATH}`, 'pty-manager')

      // ==========================================================
      // ===== 核心改动：使用 node --require 方式启动 claude ========
      // ==========================================================

      // 获取拦截器脚本路径（需要处理 asar 包的情况）
      const interceptorScript = await this.getInterceptorScriptPath();

      // 先获取claude命令的实际路径
      const claudeCommand = await this.getClaudeCommandPath();

      // 使用 node --require 启动 claude
      const command = 'node';
      const args = ['--require', interceptorScript, claudeCommand, ...(options.args || [])];

      // 保存启动参数用于错误诊断
      this.lastInterceptorScript = interceptorScript;
      this.lastClaudeCommand = claudeCommand;
      this.lastWorkingDirectory = workingDirectory;
      this.lastArgs = options.args || [];

      logger.info(`创建专用 PTY 进程: command=${command}, args=[${args.join(', ')}], cwd=${workingDirectory}`, 'pty-manager')
      logger.info(`使用拦截器脚本: ${interceptorScript}`, 'pty-manager')

      this.ptyProcess = pty.spawn(command, args, {
        name: 'xterm-color',
        cols,
        rows,
        cwd: workingDirectory,
        env: mergedEnv,
        encoding: 'utf8',
        useConpty: os.platform() === 'win32' && os.release().startsWith('10')
      })

      logger.info(`专用 Claude PTY 进程已创建，PID: ${this.ptyProcess.pid}`, 'pty-manager')

      this.setupEventHandlers()
      
      // 获取并显示渠道信息
      const channelInfo = await this.getClaudeChannelInfo()
      const channelMessage = this.formatChannelInfo(channelInfo)
      
      // 发送渠道信息到终端
      if (!this.isDestroyed && this.mainWindow && !this.mainWindow.isDestroyed()) {
        try {
          this.mainWindow.webContents.send('terminal:data', {
            sessionId: this.sessionId,
            data: channelMessage
          })
        } catch (error) {
          logger.warn(`无法发送渠道信息到终端: ${(error as Error).message}`, 'pty-manager')
        }
      }
      
      // 设置会话就绪检测超时（15秒）
      this.startTime = Date.now()
      this.setupSessionReadyTimeout()
      
      logger.info('进程启动成功', 'pty-manager')

    } catch (error) {
      const errorMessage = (error as Error).message
      logger.error('启动专用 Claude 进程失败', 'pty-manager', error as Error)

      let userFriendlyMessage = `\r\n\x1b[31mError: Failed to start Claude process.\x1b[0m\r\n`
      if (errorMessage.includes('ENOENT')) {
        userFriendlyMessage += `\x1b[33mReason: The 'claude' command was not found in your system's PATH.\x1b[0m\r\n`
        userFriendlyMessage += `\x1b[90mPlease ensure the Claude CLI is installed globally:\x1b[0m\r\n`
        userFriendlyMessage += `\x1b[90mnpm install -g @anthropic-ai/claude-code\x1b[0m\r\n`
      } else {
        userFriendlyMessage += `\x1b[33mReason: ${errorMessage}\x1b[0m\r\n`
      }

      this.mainWindow?.webContents.send('terminal:data', {
        sessionId: this.sessionId,
        data: userFriendlyMessage
      })

      this.mainWindow?.webContents.send('terminal:closed', { sessionId: this.sessionId, error: true })

      throw error
    }
  }

  public async stop(): Promise<void> {
    if (!this.ptyProcess) {
      logger.info('没有进程需要停止', 'pty-manager')
      return
    }

    logger.info('停止进程...', 'pty-manager')

    // Mark as destroyed to prevent further IPC communication
    this.isDestroyed = true

    // Clear timeout
    this.clearSessionReadyTimeout()

    try {
      // Send exit command based on platform
      if (os.platform() === 'win32') {
        this.ptyProcess.write('exit\r\n')
      } else {
        this.ptyProcess.write('exit\n')
      }

      // Wait a moment for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Force kill if still running
      if (this.ptyProcess) {
        this.ptyProcess.kill()
      }
    } catch (error) {
      logger.error('停止过程中出错', 'pty-manager', error as Error)
    } finally {
      this.ptyProcess = null
      this.mainWindow = null
      logger.info('进程已停止', 'pty-manager')
    }
  }

  public sendInput(data: string): void {
    if (this.ptyProcess) {
      this.ptyProcess.write(data)
    } else {
      logger.warn('无法发送输入 - 进程未运行', 'pty-manager')
    }
  }

  public resize(cols: number, rows: number): void {
    if (this.ptyProcess) {
      this.ptyProcess.resize(cols, rows)
    } else {
      logger.warn('无法调整大小 - 进程未运行', 'pty-manager')
    }
  }


  public isRunning(): boolean {
    return this.ptyProcess !== null
  }

  public destroy(): void {
    this.isDestroyed = true
    this.clearSessionReadyTimeout()
    this.mainWindow = null
  }

  private setupEventHandlers(): void {
    if (!this.ptyProcess) return
    logger.info('为专用 Claude PTY 进程设置事件处理器', 'pty-manager')

    let outputBuffer = '' // 用于收集输出以便错误分析

    this.ptyProcess.onData((data: string) => {
      // 收集输出用于错误分析和调试
      outputBuffer += data
      this.allOutputBuffer += data

      // 日志前缀过滤处理，获取处理后的数据
      const processedData = this.processInterceptorLogs(data)
      
      // 详细记录Claude输出用于调试
      if (data.trim()) {
        logger.debug(`[${this.sessionId}] Claude原始输出: "${data.replace(/\r\n/g, '\\r\\n').replace(/\n/g, '\\n')}"`, 'pty-manager')
      }
      
      // 如果所有内容都被过滤了，仍然要检查会话就绪状态
      if (!processedData.trim() && data.trim()) {
        logger.debug(`[${this.sessionId}] 输出被完全过滤，但仍检查会话状态`, 'pty-manager')
      }

      // 检查是否包含错误信息
      if (data.includes('Error') || data.includes('error') || data.includes('ERROR')) {
        logger.warn(`[${this.sessionId}] Claude输出包含错误信息: "${data.replace(/\r\n/g, ' ')}"`, 'pty-manager')
      }

      // 多种方式检测会话就绪状态
      this.detectSessionReadiness(data)

      // Check if manager is destroyed or window is destroyed before sending IPC
      if (!this.isDestroyed && this.mainWindow && !this.mainWindow.isDestroyed()) {
        try {
          // Only send data if it's not completely filtered out
          if (processedData) {
            this.mainWindow.webContents.send('terminal:data', {
              sessionId: this.sessionId,
              data: processedData
            })
          }
        } catch (error) {
          logger.warn(`无法发送终端数据到渲染进程: ${(error as Error).message}`, 'pty-manager')
        }
      }
    })

    this.ptyProcess.onExit((exitInfo) => {
      const { exitCode, signal } = exitInfo

      // 记录详细的退出信息
      if (exitCode !== 0) {
        logger.error(`Claude PTY 进程异常退出，代码: ${exitCode}，信号: ${signal}，会话 ${this.sessionId}`, 'pty-manager')

        // 详细的错误诊断信息
        logger.error(`启动命令: node --require ${this.lastInterceptorScript} ${this.lastClaudeCommand} ${this.lastArgs.join(' ')}`, 'pty-manager')
        logger.error(`工作目录: ${this.lastWorkingDirectory}`, 'pty-manager')
        
        // 如果有输出缓冲区内容，记录最后的输出
        if (outputBuffer.trim()) {
          const lastOutput = outputBuffer.slice(-500) // 记录最后500个字符
          logger.error(`最后的输出内容: ${lastOutput.replace(/\r\n/g, ' ')}`, 'pty-manager')
        } else {
          logger.error('没有捕获到任何输出内容', 'pty-manager')
        }

        // 根据退出代码提供更详细的错误信息
        let errorReason = '未知错误'
        switch (exitCode) {
          case 1:
            errorReason = 'Claude CLI执行失败或命令错误'
            break
          case 126:
            errorReason = 'Claude CLI命令无法执行'
            break
          case 127:
            errorReason = 'Claude CLI命令未找到'
            break
          case 130:
            errorReason = 'Claude CLI被Ctrl+C中断'
            break
          default:
            errorReason = `Claude CLI退出代码: ${exitCode}`
        }
        logger.error(`退出原因分析: ${errorReason}`, 'pty-manager')
      } else {
        logger.info(`Claude PTY 进程正常退出，代码: ${exitCode}，信号: ${signal}，会话 ${this.sessionId}`, 'pty-manager')
      }

      this.ptyProcess = null

      // Check if manager is destroyed or window is destroyed before sending IPC
      if (!this.isDestroyed && this.mainWindow && !this.mainWindow.isDestroyed()) {
        try {
          const exitMessage = `\r\n\x1b[36m[Claude session ended. Terminal closed.]\x1b[0m\r\n`
          this.mainWindow.webContents.send('terminal:data', {
            sessionId: this.sessionId,
            data: exitMessage
          })

          setTimeout(() => {
            // Double check again before sending terminal:closed
            if (!this.isDestroyed && this.mainWindow && !this.mainWindow.isDestroyed()) {
              try {
                this.mainWindow.webContents.send('terminal:closed', { sessionId: this.sessionId, error: exitCode !== 0 })
              } catch (error) {
                logger.warn(`无法发送terminal:closed事件到渲染进程: ${(error as Error).message}`, 'pty-manager')
              }
            }
          }, 500)
        } catch (error) {
          logger.warn(`无法发送退出消息到渲染进程: ${(error as Error).message}`, 'pty-manager')
        }
      }
      
      // Call the exit callback if provided
      if (this.onProcessExit) {
        try {
          this.onProcessExit(this.sessionId, exitCode, signal)
        } catch (error) {
          logger.warn(`退出回调执行失败: ${(error as Error).message}`, 'pty-manager')
        }
      }
    })
  }

  /**
   * 获取拦截器脚本路径，处理 asar 包的情况
   */
  private async getInterceptorScriptPath(): Promise<string> {
    const originalPath = path.resolve(__dirname, 'claude-interceptor.js');
    
    // 检查是否在 asar 包中
    if (originalPath.includes('.asar')) {
      // 在 asar 包中，需要将文件复制到临时目录
      const tmpDir = os.tmpdir();
      const tmpInterceptorPath = path.join(tmpDir, 'claude-interceptor.js');
      
      try {
        // 检查临时文件是否已存在且是最新的
        const originalStats = await fs.promises.stat(originalPath);
        let needsCopy = true;
        
        try {
          const tmpStats = await fs.promises.stat(tmpInterceptorPath);
          // 如果临时文件存在且修改时间不早于原文件，则不需要复制
          needsCopy = tmpStats.mtime < originalStats.mtime;
        } catch {
          // 临时文件不存在，需要复制
          needsCopy = true;
        }
        
        if (needsCopy) {
          const interceptorContent = await fs.promises.readFile(originalPath, 'utf8');
          await fs.promises.writeFile(tmpInterceptorPath, interceptorContent, 'utf8');
          logger.info(`已将拦截器脚本复制到临时目录: ${tmpInterceptorPath}`, 'pty-manager');
        }
        
        return tmpInterceptorPath;
      } catch (error) {
        logger.error('复制拦截器脚本到临时目录失败', 'pty-manager', error as Error);
        throw new Error(`无法复制拦截器脚本: ${(error as Error).message}`);
      }
    } else {
      // 不在 asar 包中，直接使用原路径
      return originalPath;
    }
  }

  /**
   * 获取Claude命令的完整路径
   */
  private async getClaudeCommandPath(): Promise<string> {
    try {
      const claudePath = await claudePathManager.getClaudePath();
      if (claudePath) {
        logger.info(`使用统一路径管理器获取到Claude路径: ${claudePath}`, 'pty-manager');
        return claudePath;
      } else {
        const error = 'Claude CLI command not found in PATH';
        logger.error(error, 'pty-manager');
        throw new Error(error);
      }
    } catch (error) {
      logger.error('通过路径管理器获取Claude路径失败', 'pty-manager', error as Error);
      throw error;
    }
  }

  /**
   * 获取当前语言环境
   */
  private getCurrentLanguage(): 'en' | 'zh-CN' {
    // 从系统环境变量或其他方式获取语言，默认为英文
    const lang = process.env.LANG || process.env.LANGUAGE || 'en'
    return lang.includes('zh') ? 'zh-CN' : 'en'
  }

  /**
   * 获取翻译文本
   */
  private getTranslation(key: string): string {
    const lang = this.getCurrentLanguage()
    const translations = {
      en: {
        channelInfo: 'Claude Channel Information',
        channel: 'Channel',
        model: 'Model',
        apiUrl: 'API URL',
        anthropicOfficial: 'Anthropic Official',
        claudeAi: 'Claude.ai',
        customApi: 'Custom API'
      },
      'zh-CN': {
        channelInfo: 'Claude 渠道信息',
        channel: '渠道',
        model: '模型',
        apiUrl: 'API 地址',
        anthropicOfficial: 'Anthropic 官方',
        claudeAi: 'Claude.ai',
        customApi: '自定义 API'
      }
    }
    
    return translations[lang][key as keyof typeof translations[typeof lang]] || key
  }

  /**
   * 格式化渠道信息显示
   */
  private formatChannelInfo(channelInfo: ClaudeChannelInfo): string {
    const { model, apiBaseUrl, channelName } = channelInfo
    
    // 翻译渠道名称
    let translatedChannelName = channelName
    if (channelName === 'Anthropic Official') {
      translatedChannelName = this.getTranslation('anthropicOfficial')
    } else if (channelName === 'Claude.ai') {
      translatedChannelName = this.getTranslation('claudeAi')
    } else if (channelName === 'Custom API') {
      translatedChannelName = this.getTranslation('customApi')
    }
    
    const boxWidth = 60
    const title = this.getTranslation('channelInfo')
    const padding = Math.max(0, Math.floor((boxWidth - title.length - 4) / 2))
    const titleLine = '─'.repeat(padding) + ` ${title} ` + '─'.repeat(boxWidth - padding - title.length - 5)
    
    let message = `\x1b[36m╭${titleLine}╮\x1b[0m\r\n`
    message += `\x1b[36m│\x1b[0m \x1b[1m${this.getTranslation('channel')}:\x1b[0m ${translatedChannelName}\r\n`
    message += `\x1b[36m│\x1b[0m \x1b[1m${this.getTranslation('model')}:\x1b[0m   ${model}\r\n`
    
    if (apiBaseUrl) {
      message += `\x1b[36m│\x1b[0m \x1b[1m${this.getTranslation('apiUrl')}:\x1b[0m ${apiBaseUrl}\r\n`
    }
    
    message += `\x1b[36m╰${'─'.repeat(boxWidth - 2)}╯\x1b[0m\r\n\r\n`
    
    return message
  }

  /**
   * 获取Claude渠道信息
   */
  private async getClaudeChannelInfo(): Promise<ClaudeChannelInfo> {
    try {
      let model = 'sonnet' // 默认模型
      let apiBaseUrl: string | undefined
      let channelName = 'Anthropic Official'
      
      // 首先尝试从CC Copilot的设置中读取第三方API配置
      try {
        const appDataPath = this.getAppDataPath()
        const appSettingsPath = path.join(appDataPath, 'settings.json')
        
        if (fs.existsSync(appSettingsPath)) {
          const appSettingsContent = await fs.promises.readFile(appSettingsPath, 'utf8')
          const appSettings = JSON.parse(appSettingsContent)
          
          // 检查是否有活动的服务提供方
          if (appSettings.activeServiceProviderId && appSettings.serviceProviders) {
            const activeProvider = appSettings.serviceProviders.find((p: any) => p.id === appSettings.activeServiceProviderId)
            
            if (activeProvider) {
              if (activeProvider.type === 'claude_official') {
                channelName = 'Anthropic Official'
                // 尝试从Claude设置文件读取模型
                const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json')
                if (fs.existsSync(claudeSettingsPath)) {
                  try {
                    const claudeSettingsContent = await fs.promises.readFile(claudeSettingsPath, 'utf8')
                    const claudeSettings = JSON.parse(claudeSettingsContent)
                    if (claudeSettings.model) {
                      model = claudeSettings.model
                    }
                  } catch (error) {
                    logger.warn('读取Claude设置文件失败', 'pty-manager', error as Error)
                  }
                }
              } else if (activeProvider.type === 'third_party') {
                // 第三方API配置
                channelName = activeProvider.name || 'Third-party API'
                
                // 获取活动账号的配置
                if (activeProvider.activeAccountId && activeProvider.accounts) {
                  const activeAccount = activeProvider.accounts.find((acc: any) => acc.id === activeProvider.activeAccountId)
                  if (activeAccount) {
                    apiBaseUrl = activeAccount.baseUrl
                    // 第三方API通常不指定具体模型，使用通用名称
                    model = 'claude-3.5-sonnet'
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        logger.warn('读取CC Copilot设置失败，回退到Claude CLI设置', 'pty-manager', error as Error)
      }
      
      // 如果没有从CC Copilot设置中找到配置，回退到Claude CLI设置
      if (!apiBaseUrl && channelName === 'Anthropic Official') {
        const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json')
        if (fs.existsSync(claudeSettingsPath)) {
          try {
            const settingsContent = await fs.promises.readFile(claudeSettingsPath, 'utf8')
            const settings = JSON.parse(settingsContent)
            if (settings.model) {
              model = settings.model
            }
            // 检查是否有自定义API基础URL
            if (settings.env && settings.env.ANTHROPIC_API_URL) {
              apiBaseUrl = settings.env.ANTHROPIC_API_URL
            }
          } catch (error) {
            logger.warn('读取Claude设置文件失败', 'pty-manager', error as Error)
          }
        }
        
        // 从环境变量检查API基础URL
        if (!apiBaseUrl && process.env.ANTHROPIC_API_URL) {
          apiBaseUrl = process.env.ANTHROPIC_API_URL
        }
        
        // 重新确定渠道名称
        if (apiBaseUrl) {
          if (apiBaseUrl.includes('claude.ai')) {
            channelName = 'Claude.ai'
          } else {
            channelName = 'Custom API'
          }
        }
      }
      
      return {
        model,
        apiBaseUrl,
        channelName,
        timestamp: Date.now()
      }
    } catch (error) {
      logger.error('获取Claude渠道信息失败', 'pty-manager', error as Error)
      return {
        model: 'sonnet',
        channelName: 'Anthropic Official',
        timestamp: Date.now()
      }
    }
  }

  /**
   * 获取应用数据路径
   */
  private getAppDataPath(): string {
    const platform = os.platform()
    if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'CC Copilot')
    } else if (platform === 'win32') {
      return path.join(os.homedir(), 'AppData', 'Roaming', 'CC Copilot')
    } else {
      return path.join(os.homedir(), '.config', 'CC Copilot')
    }
  }

  /**
   * 设置会话就绪检测超时
   */
  private setupSessionReadyTimeout(): void {
    // 15秒超时
    this.sessionReadyTimeout = setTimeout(() => {
      if (!this.hasDetectedClaudePrompt && this.onSessionReady) {
        const elapsed = Date.now() - this.startTime
        logger.warn(`[${this.sessionId}] 会话就绪检测超时 (${elapsed}ms)，使用fallback机制`, 'pty-manager')
        
        // 记录调试信息
        if (this.allOutputBuffer.trim()) {
          logger.info(`[${this.sessionId}] 完整输出内容用于调试: "${this.allOutputBuffer.slice(-500)}"`, 'pty-manager')
        } else {
          logger.warn(`[${this.sessionId}] 未收到任何Claude输出`, 'pty-manager')
        }
        
        // 使用时间戳作为fallback session ID
        const fallbackSessionId = Date.now().toString()
        logger.info(`[${this.sessionId}] 使用fallback session ID: ${fallbackSessionId}`, 'pty-manager')
        
        this.hasDetectedClaudePrompt = true
        this.onSessionReady(fallbackSessionId)
      }
    }, 15000)
  }

  /**
   * 清除会话就绪检测超时
   */
  private clearSessionReadyTimeout(): void {
    if (this.sessionReadyTimeout) {
      clearTimeout(this.sessionReadyTimeout)
      this.sessionReadyTimeout = null
    }
  }

  /**
   * 多种方式检测会话就绪状态
   */
  private detectSessionReadiness(data: string): void {
    if (this.hasDetectedClaudePrompt || !this.onSessionReady) {
      return
    }

    // 方法1: 原始的 "Session created:" 检测
    const sessionCreatedMatch = data.match(/Session created: (\S+\.jsonl)/)
    if (sessionCreatedMatch && sessionCreatedMatch[1]) {
      const claudeSessionFile = sessionCreatedMatch[1]
      const claudeSessionId = path.basename(claudeSessionFile, '.jsonl')
      logger.info(`[${this.sessionId}] 检测到 "Session created:" 消息，Claude会话ID: ${claudeSessionId}`, 'pty-manager')
      this.markSessionReady(claudeSessionId, 'Session created message')
      return
    }

    // 方法2: 检测Claude提示符或交互式界面
    const claudePromptPatterns = [
      /Claude\s*>/i,                    // Claude>
      /\$\s*$/,                         // Shell prompt
      />\s*$/,                          // Generic prompt
      /claude-code/i,                   // claude-code 命令名
      /Welcome to Claude/i,             // 欢迎信息
      /How can I help you/i,            // 帮助信息
      /What would you like/i,           // 询问信息
      /Ready to assist/i,               // 准备帮助
      /ask me anything/i,               // 提问邀请
    ]

    for (const pattern of claudePromptPatterns) {
      if (pattern.test(data)) {
        const fallbackSessionId = Date.now().toString()
        logger.info(`[${this.sessionId}] 检测到Claude提示符模式: ${pattern}, 使用fallback session ID: ${fallbackSessionId}`, 'pty-manager')
        this.markSessionReady(fallbackSessionId, `Prompt pattern: ${pattern}`)
        return
      }
    }

    // 方法3: 检测拦截器初始化完成
    if (data.includes('[Claude Interceptor] 拦截器初始化完成')) {
      // 等待一小段时间让Claude完全启动
      setTimeout(() => {
        if (!this.hasDetectedClaudePrompt && this.onSessionReady) {
          const fallbackSessionId = Date.now().toString()
          logger.info(`[${this.sessionId}] 拦截器初始化完成，使用fallback session ID: ${fallbackSessionId}`, 'pty-manager')
          this.markSessionReady(fallbackSessionId, 'Interceptor initialized')
        }
      }, 2000)
      return
    }

    // 方法4: 检测任何表明Claude正在工作的输出
    const workingIndicators = [
      /thinking/i,
      /processing/i,
      /analyzing/i,
      /understanding/i,
      /I'll help/i,
      /I can help/i,
      /Let me/i,
    ]

    for (const indicator of workingIndicators) {
      if (indicator.test(data)) {
        const fallbackSessionId = Date.now().toString()
        logger.info(`[${this.sessionId}] 检测到Claude工作指示符: ${indicator}, 使用fallback session ID: ${fallbackSessionId}`, 'pty-manager')
        this.markSessionReady(fallbackSessionId, `Working indicator: ${indicator}`)
        return
      }
    }
  }

  /**
   * 标记会话就绪
   */
  private markSessionReady(claudeSessionId: string, reason: string): void {
    if (this.hasDetectedClaudePrompt) {
      return
    }
    
    this.hasDetectedClaudePrompt = true
    this.clearSessionReadyTimeout()
    
    const elapsed = Date.now() - this.startTime
    logger.info(`[${this.sessionId}] 会话就绪检测成功 (${elapsed}ms), 原因: ${reason}, Claude会话ID: ${claudeSessionId}`, 'pty-manager')
    
    if (this.onSessionReady) {
      this.onSessionReady(claudeSessionId)
    }
  }

  /**
   * 处理拦截器日志，根据前缀决定是否过滤输出
   * @param data PTY输出的数据
   * @returns 处理后的数据，如果完全被过滤则返回空字符串
   */
  private processInterceptorLogs(data: string): string {
    const lines = data.split('\n')
    const processedLines: string[] = []

    for (const line of lines) {
      // 检查是否包含拦截器日志前缀
      if (line.includes('[TERMINAL]') || line.includes('[SILENT]')) {
        // 提取日志信息（去除前缀）
        const logContent = line.replace(/\[TERMINAL\]\s*/, '').replace(/\[SILENT\]\s*/, '')
        
        // 决定日志级别
        let logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info'
        if (logContent.includes('ERROR') || logContent.includes('error') || logContent.includes('失败')) {
          logLevel = 'error'
        } else if (logContent.includes('WARN') || logContent.includes('warn') || logContent.includes('警告')) {
          logLevel = 'warn'
        } else if (logContent.includes('DEBUG') || logContent.includes('debug')) {
          logLevel = 'debug'
        }

        // 保存到日志文件
        logger[logLevel](`[INTERCEPTOR] ${logContent}`, 'claude-interceptor')
        
        // 对于[TERMINAL]前缀的日志，显示在终端但清理格式
        if (line.includes('[TERMINAL]')) {
          processedLines.push(logContent)
        }
        // SILENT前缀的日志不输出到终端，直接跳过
      } else {
        // 非拦截器日志，保持原样
        processedLines.push(line)
      }
    }

    const result = processedLines.join('\n')
    
    // 清理重复的提示符和多余的空行，防止双光标问题
    return result
      .replace(/\r\n\r\n+/g, '\r\n') // 合并多个空行
      .replace(/\n\n+/g, '\n') // 合并多个换行
      .replace(/>\s*>\s*/g, '> ') // 清理重复的提示符
  }

}