import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import * as os from 'os'
import * as fs from 'fs'
import { logger } from './logger'
import path from 'path'
import { claudePathManager } from './claude-path-manager'

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
  private ptyProcess: pty.IPty | null = null
  private mainWindow: BrowserWindow | null = null
  private currentEnv: Record<string, string | undefined> = {}
  private sessionId: string

  constructor(
    mainWindow: BrowserWindow,
    sessionId: string,
    onSessionReadyCallback?: (claudeSessionId: string) => void
  ) {
    this.mainWindow = mainWindow;
    this.sessionId = sessionId;
    this.currentEnv = { ...process.env };

    if (onSessionReadyCallback) {
      this.onSessionReady = onSessionReadyCallback;
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

      const mergedEnv = {
        ...this.currentEnv,
        ...env,
        CLAUDE_PROJECT_DIR: workingDirectory,
      }

      // 记录关键环境变量以便调试
      logger.info(`环境变量设置: CLAUDE_PROJECT_DIR=${mergedEnv.CLAUDE_PROJECT_DIR}`, 'pty-manager')

      // ==========================================================
      // ===== 核心改动：使用 node --require 方式启动 claude ========
      // ==========================================================

      // 获取拦截器脚本路径
      const interceptorScript = path.resolve(__dirname, 'claude-interceptor.js');

      // 先获取claude命令的实际路径
      const claudeCommand = await this.getClaudeCommandPath();

      // 使用 node --require 启动 claude
      const command = 'node';
      const args = ['--require', interceptorScript, claudeCommand, ...(options.args || [])];

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

  private setupEventHandlers(): void {
    if (!this.ptyProcess) return
    logger.info('为专用 Claude PTY 进程设置事件处理器', 'pty-manager')

    let outputBuffer = '' // 用于收集输出以便错误分析

    this.ptyProcess.onData((data: string) => {
      // 收集输出用于错误分析
      outputBuffer += data

      // 日志前缀过滤处理，获取处理后的数据
      const processedData = this.processInterceptorLogs(data)
      
      // 如果所有内容都被过滤了，不继续处理
      if (!processedData.trim()) {
        return
      }
      
      // 使用处理后的数据继续后续逻辑
      // data = processedData

      // 检查是否包含错误信息
      if (data.includes('Error') || data.includes('error') || data.includes('ERROR')) {
        logger.warn(`[${this.sessionId}] Claude输出包含错误信息: "${data.replace(/\r\n/g, ' ')}"`, 'pty-manager')
      }

      // Check if a new claude session was created
      const match = data.match(/Session created: (\S+\.jsonl)/);
      if (match && match[1]) {
        const claudeSessionFile = match[1];
        const claudeSessionId = path.basename(claudeSessionFile, '.jsonl');
        logger.info(`Detected new Claude session: ${claudeSessionId}`, 'pty-manager');
        if (this.onSessionReady) {
          this.onSessionReady(claudeSessionId);
        }
      }

      logger.debug(`[${this.sessionId}] 从 Claude PTY 接收数据: "${data.slice(0, 100).replace(/\r\n/g, ' ')}${data.length > 100 ? '...' : ''}"`, 'pty-manager')

      this.mainWindow?.webContents.send('terminal:data', {
        sessionId: this.sessionId,
        data
      })
    })

    this.ptyProcess.onExit((exitInfo) => {
      const { exitCode, signal } = exitInfo

      // 记录详细的退出信息
      if (exitCode !== 0) {
        logger.error(`Claude PTY 进程异常退出，代码: ${exitCode}，信号: ${signal}，会话 ${this.sessionId}`, 'pty-manager')

        // 如果有输出缓冲区内容，记录最后的输出
        if (outputBuffer.trim()) {
          const lastOutput = outputBuffer.slice(-500) // 记录最后500个字符
          logger.error(`最后的输出内容: ${lastOutput.replace(/\r\n/g, ' ')}`, 'pty-manager')
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

      const exitMessage = `\r\n\x1b[36m[Claude session ended. Terminal closed.]\x1b[0m\r\n`
      this.mainWindow?.webContents.send('terminal:data', {
        sessionId: this.sessionId,
        data: exitMessage
      })

      setTimeout(() => {
        this.mainWindow?.webContents.send('terminal:closed', { sessionId: this.sessionId, error: exitCode !== 0 })
      }, 500)
    })
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
        // SILENT前缀的日志不输出到终端，直接跳过
      } else {
        // 非拦截器日志，保持原样
        processedLines.push(line)
      }
    }

    return processedLines.join('\n')
  }

}