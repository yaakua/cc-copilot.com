import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import * as os from 'os'
import * as path from 'path'
import { logger } from './logger'

export interface PtyOptions {
  workingDirectory?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
  autoStartClaude?: boolean
}

export class PtyManager {
  private ptyProcess: pty.IPty | null = null
  private mainWindow: BrowserWindow | null = null
  private currentEnv: Record<string, string | undefined> = {}
  private sessionId: string
  private isClaudeStarting: boolean = false
  private pendingOutput: string[] = []
  private claudeInstalled: boolean = false

  constructor(mainWindow: BrowserWindow, sessionId: string) {
    this.mainWindow = mainWindow
    this.sessionId = sessionId
    this.currentEnv = { ...process.env }
  }

  public async start(options: PtyOptions = {}): Promise<void> {
    if (this.ptyProcess) {
      logger.info('Process already running', 'pty-manager')
      return
    }

    try {
      logger.info('Starting process...', 'pty-manager')
      
      const {
        workingDirectory = process.cwd(),
        env = {},
        cols = 80,
        rows = 24
      } = options

      // Merge environment variables
      const mergedEnv = {
        ...this.currentEnv,
        ...env,
        // 设置默认的 claude-code 代理地址
        ANTHROPIC_BASE_URL: env.ANTHROPIC_BASE_URL || 'http://127.0.0.1:31299'
      }

      // Determine shell and command based on platform and options
      let shell: string
      let shellArgs: string[] = []
      
      // Start shell - always use bash/powershell
      shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'
      shellArgs = []
      
      if (options.autoStartClaude) {
        logger.info('Will start claude-code after shell initialization', 'pty-manager')
        this.claudeInstalled = true  // Assume claude is available
      }
      
      // Create PTY process
      this.ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-color',
        cols,
        rows,
        cwd: workingDirectory,
        env: mergedEnv,
        encoding: 'utf8',
        // Use ConPTY on Windows 10+ for better compatibility
        useConpty: os.platform() === 'win32' && os.release().startsWith('10')
      })

      this.setupEventHandlers()
      logger.info('Process started successfully', 'pty-manager')
      
      // Send initial welcome message and start Claude if needed
      this.sendInitialMessage()
      
      // Set flag if claude-code should be started
      if (options.autoStartClaude && this.claudeInstalled) {
        this.isClaudeStarting = true
        logger.info('Will start claude-code after shell initialization', 'pty-manager')
        
        // Start Claude after a short delay to allow shell to initialize
        setTimeout(() => {
          this.startClaudeInShell()
        }, 1000)
      }
    } catch (error) {
      logger.error('Failed to start', 'pty-manager', error as Error)
      throw error
    }
  }

  public async stop(): Promise<void> {
    if (!this.ptyProcess) {
      logger.info('No process to stop', 'pty-manager')
      return
    }

    logger.info('Stopping process...', 'pty-manager')
    
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
      logger.error('Error during stop', 'pty-manager', error as Error)
    } finally {
      this.ptyProcess = null
      logger.info('Process stopped', 'pty-manager')
    }
  }

  public sendInput(data: string): void {
    if (this.ptyProcess) {
      this.ptyProcess.write(data)
    } else {
      logger.warn('Cannot send input - process not running', 'pty-manager')
    }
  }

  public resize(cols: number, rows: number): void {
    if (this.ptyProcess) {
      this.ptyProcess.resize(cols, rows)
      logger.info(`Resized to ${cols}x${rows}`, 'pty-manager')
    } else {
      logger.warn('Cannot resize - process not running', 'pty-manager')
    }
  }

  public changeDirectory(directory: string): void {
    if (!this.ptyProcess) {
      logger.warn('Cannot change directory - process not running', 'pty-manager')
      return
    }

    const resolvedPath = path.resolve(directory)
    const command = os.platform() === 'win32' 
      ? `cd "${resolvedPath}"\r\n`
      : `cd "${resolvedPath}"\n`
    
    logger.info(`Changing directory to: ${resolvedPath}`, 'pty-manager')
    this.ptyProcess.write(command)
  }

  public setEnvironmentVariable(key: string, value: string): void {
    this.currentEnv[key] = value
    
    if (!this.ptyProcess) {
      logger.info(`Environment variable ${key} set for next session`, 'pty-manager')
      return
    }

    // Set environment variable in current session
    const command = os.platform() === 'win32'
      ? `$env:${key}="${value}"\r\n`
      : `export ${key}="${value}"\n`
    
    logger.info(`Setting environment variable: ${key}=${value}`, 'pty-manager')
    this.ptyProcess.write(command)
  }

  public getEnvironmentVariable(key: string): string | undefined {
    return this.currentEnv[key]
  }

  public getAllEnvironmentVariables(): Record<string, string|undefined> {
    return { ...this.currentEnv }
  }

  private startClaudeInShell(): void {
    if (!this.ptyProcess) {
      logger.warn('Cannot start claude - process not running', 'pty-manager')
      return
    }

    logger.info('Starting claude command in shell...', 'pty-manager')
    const command = os.platform() === 'win32' ? 'claude\r\n' : 'claude\n'
    this.ptyProcess.write(command)
  }

  public async startClaudeCode(workingDirectory?: string): Promise<void> {
    if (!this.ptyProcess) {
      logger.warn('Cannot start claude-code - process not running', 'pty-manager')
      return
    }

    // Change to working directory if provided
    if (workingDirectory) {
      this.changeDirectory(workingDirectory)
    }

    // Start claude command
    const command = os.platform() === 'win32' ? 'claude\r\n' : 'claude\n'
    logger.info('Starting claude-code...', 'pty-manager')
    this.ptyProcess.write(command)
  }

  private isClaudeReady(data: string): boolean {
    // Check for various claude-code ready indicators
    const readyPatterns = [
      'claude code',
      'claude.ai/code',
      'connected to claude',
      'assistant:',
      'how can i help you',
      'what would you like to work on',
      'claude-code>',
      'claude@',
      'welcome to claude',
      'sonnet',
      'anthropic',
      'powered by the model'
    ]
    
    const lowerData = data.toLowerCase()
    return readyPatterns.some(pattern => lowerData.includes(pattern))
  }

  public isRunning(): boolean {
    return this.ptyProcess !== null
  }

  private setupEventHandlers(): void {
    if (!this.ptyProcess) return

    // Handle data from PTY - forward to renderer with session ID
    this.ptyProcess.onData((data: string) => {
      if (this.isClaudeStarting) {
        // Buffer output while claude-code is starting
        this.pendingOutput.push(data)
        
        // Check if claude-code has started (look for specific prompt patterns)
        if (this.isClaudeReady(data)) {
          logger.info(`Claude-code ready for session ${this.sessionId}`, 'pty-manager')
          this.isClaudeStarting = false
          
          // Send welcome message first
          this.mainWindow?.webContents.send('terminal:data', {
            sessionId: this.sessionId,
            data: '\x1b[36mCC Copilot Terminal\x1b[0m\r\n' +
                  '\x1b[32m✓ Claude Code Ready\x1b[0m\r\n\r\n'
          })
          
          // Send buffered output
          const bufferedData = this.pendingOutput.join('')
          this.mainWindow?.webContents.send('terminal:data', {
            sessionId: this.sessionId,
            data: bufferedData
          })
          this.pendingOutput = []
        }
      } else {
        // Normal operation - forward data immediately
        this.mainWindow?.webContents.send('terminal:data', {
          sessionId: this.sessionId,
          data
        })
      }
    })

    // Handle PTY exit
    this.ptyProcess.onExit((exitCode) => {
      logger.info(`Process exited with code: ${exitCode.exitCode} for session ${this.sessionId}`, 'pty-manager')
      this.ptyProcess = null
      this.isClaudeStarting = false
      this.mainWindow?.webContents.send('terminal:data', {
        sessionId: this.sessionId,
        data: `\r\n[Process exited with code ${exitCode.exitCode}]\r\n`
      })
    })
  }

  private sendInitialMessage(): void {
    // Only send initial message if not auto-starting claude
    if (!this.isClaudeStarting) {
      setTimeout(() => {
        if (this.ptyProcess) {
          let message = '\x1b[36mCC Copilot Terminal Ready\x1b[0m\r\n' +
                       '\x1b[32m✓ Connected to real terminal\x1b[0m\r\n'
          
          if (this.claudeInstalled) {
            message += '\x1b[90mType commands or start claude-code with: npx @anthropic-ai/claude-code\x1b[0m\r\n\r\n'
          } else {
            message += '\x1b[31m⚠️  Claude CLI not detected\x1b[0m\r\n' +
                      '\x1b[33mPlease install Claude CLI first. Check the status bar for installation instructions.\x1b[0m\r\n\r\n'
          }
          
          this.mainWindow?.webContents.send('terminal:data', {
            sessionId: this.sessionId,
            data: message
          })
        }
      }, 100)
    } else {
      if (!this.claudeInstalled) {
        // Show error message instead of trying to start Claude
        setTimeout(() => {
          if (this.ptyProcess) {
            this.mainWindow?.webContents.send('terminal:data', {
              sessionId: this.sessionId,
              data: '\x1b[31mError: Claude CLI not detected.\x1b[0m\r\n' +
                    '\x1b[33mPlease install Claude CLI first. Check the status bar for installation instructions.\x1b[0m\r\n\r\n'
            })
          }
        }, 100)
      }
      // For auto-starting claude when installed, don't send any initial message
      // We'll wait for claude-code to be ready
    }
  }
}