import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { spawn } from 'child_process'
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
  private shouldAutoStartClaude: boolean = false
  private shellReady: boolean = false

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
        workingDirectory,
        env = {},
        cols = 80,
        rows = 24
      } = options

      // 确保有有效的工作目录
      if (!workingDirectory) {
        throw new Error('Working directory is required when starting PTY process')
      }
      
      // 验证工作目录是否存在和可访问
      try {
        const stats = fs.statSync(workingDirectory)
        if (!stats.isDirectory()) {
          throw new Error(`Working directory is not a directory: ${workingDirectory}`)
        }
        // 测试目录是否可访问
        fs.accessSync(workingDirectory, fs.constants.R_OK | fs.constants.X_OK)
        logger.info(`Working directory verified: ${workingDirectory}`, 'pty-manager')
      } catch (error) {
        logger.error(`Working directory validation failed: ${workingDirectory}`, 'pty-manager', error as Error)
        throw new Error(`Invalid working directory: ${workingDirectory} - ${(error as Error).message}`)
      }
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
      
      // Verify shell exists using which/where command
      logger.info(`Verifying shell: ${shell}`, 'pty-manager')
      
      // Simple verification - just check if shell path exists for common shells
      const commonShellPaths = {
        'bash': ['/bin/bash', '/usr/bin/bash', '/usr/local/bin/bash'],
        'zsh': ['/bin/zsh', '/usr/bin/zsh', '/usr/local/bin/zsh'],
        'sh': ['/bin/sh', '/usr/bin/sh'],
        'powershell.exe': ['powershell.exe'],
        'cmd.exe': ['cmd.exe']
      }
      
      if (shell === 'bash' && os.platform() !== 'win32') {
        // Try to find bash in common locations
        let bashFound = false
        for (const bashPath of commonShellPaths.bash) {
          try {
            if (fs.existsSync(bashPath)) {
              shell = bashPath
              bashFound = true
              logger.info(`Found bash at: ${bashPath}`, 'pty-manager')
              break
            }
          } catch (error) {
            // Continue to next path
          }
        }
        
        if (!bashFound) {
          logger.warn('Bash not found in common locations, falling back to /bin/sh', 'pty-manager')
          shell = '/bin/sh'
        }
      }
      
      this.shouldAutoStartClaude = options.autoStartClaude || false
      
      // Create PTY process
      logger.info(`Creating PTY process: shell=${shell}, cwd=${workingDirectory}`, 'pty-manager')
      
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
      
      logger.info(`PTY process created with PID: ${this.ptyProcess.pid}`, 'pty-manager')

      this.setupEventHandlers()
      logger.info('Process started successfully', 'pty-manager')
      
      // Send initial welcome message
      this.sendInitialMessage()
      
      // Check Claude installation if auto-start is enabled
      if (this.shouldAutoStartClaude) {
        logger.info('Checking Claude CLI installation...', 'pty-manager')
        this.checkClaudeInstallation().then((isInstalled) => {
          this.claudeInstalled = isInstalled
          if (isInstalled) {
            logger.info('Claude CLI found, will start after shell is ready', 'pty-manager')
          } else {
            logger.info('Claude CLI not found, showing installation instructions', 'pty-manager')
            this.sendClaudeNotFoundMessage()
          }
        })
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
    
    // 重试机制
    const attemptStart = (retries = 3) => {
      if (!this.ptyProcess) {
        logger.warn('PTY process lost during claude start attempt', 'pty-manager')
        return
      }

      try {
        const command = os.platform() === 'win32' ? 'claude\r\n' : 'claude\n'
        this.ptyProcess.write(command)
        logger.info('Claude start command sent successfully', 'pty-manager')
      } catch (error) {
        logger.warn(`Failed to send claude command, retries left: ${retries}`, 'pty-manager')
        if (retries > 0) {
          setTimeout(() => attemptStart(retries - 1), 500)
        } else {
          logger.error('Failed to start claude after all retries', 'pty-manager')
        }
      }
    }

    attemptStart()
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

  private isShellReady(data: string): boolean {
    // Check for common shell prompts that indicate shell is ready
    const shellPromptPatterns = [
      '$', // bash prompt
      '>', // PowerShell prompt
      '#', // root prompt
      '%', // zsh prompt
      '~', // home directory indicator
      '❯', // modern shell prompts
      '➜', // oh-my-zsh prompts
    ]
    
    const trimmedData = data.trim()
    const lowerData = data.toLowerCase()
    
    // Check for prompt patterns at the end of the data
    const hasPrompt = shellPromptPatterns.some(pattern => 
      trimmedData.endsWith(pattern) || trimmedData.includes(pattern + ' ')
    )
    
    // Also check for common shell startup messages
    const shellStartupIndicators = [
      'welcome',
      'last login',
      'terminal',
      'shell',
      process.env.USER || process.env.USERNAME || 'user'
    ].filter(Boolean)
    
    const hasStartupMessage = shellStartupIndicators.some(indicator => 
      lowerData.includes(indicator.toLowerCase())
    )
    
    return hasPrompt || hasStartupMessage
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

  private sendClaudeNotFoundMessage(): void {
    setTimeout(() => {
      if (this.ptyProcess) {
        this.mainWindow?.webContents.send('terminal:data', {
          sessionId: this.sessionId,
          data: '\x1b[36mCC Copilot Terminal\x1b[0m\r\n' +
                '\x1b[31m✗ Claude CLI not found\x1b[0m\r\n' +
                '\x1b[33mTo get started:\x1b[0m\r\n' +
                '\x1b[90m1. Install Claude CLI: npm install -g @anthropic-ai/claude-code\x1b[0m\r\n' +
                '\x1b[90m2. Or manually start claude: npx @anthropic-ai/claude-code\x1b[0m\r\n\r\n'
        })
      }
    }, 500)
  }

  private async checkClaudeInstallation(): Promise<boolean> {
    try {
      return new Promise<boolean>((resolve) => {
        // Try multiple detection methods
        const detectMethods = [
          // Method 1: Try claude --version with NO_DEBUG environment
          () => spawn('claude', ['--version'], { 
            stdio: 'pipe',
            shell: true,
            env: { ...process.env, NODE_OPTIONS: '', DEBUG: '' }
          }),
          // Method 2: Try which/where claude
          () => spawn(os.platform() === 'win32' ? 'where' : 'which', ['claude'], { 
            stdio: 'pipe',
            shell: true
          })
        ]
        
        let methodIndex = 0
        
        const tryNextMethod = () => {
          if (methodIndex >= detectMethods.length) {
            logger.info('All Claude detection methods failed', 'pty-manager')
            resolve(false)
            return
          }
          
          const childProcess = detectMethods[methodIndex]()
          const currentMethodIndex = methodIndex
          methodIndex++
          
          let hasValidOutput = false
          let output = ''
          let finished = false
          
          const finishMethod = (success: boolean, reason: string) => {
            if (finished) return
            finished = true
            
            // Filter out debugger messages
            const cleanOutput = output
              .replace(/Debugger attached\./g, '')
              .replace(/Waiting for the debugger to disconnect\.\.\./g, '')
              .trim()
            
            logger.info(`Claude detection method ${currentMethodIndex}: ${reason}, hasValidOutput=${hasValidOutput}, output="${cleanOutput}"`, 'pty-manager')
            
            if (success) {
              logger.info('Claude CLI detected successfully', 'pty-manager')
              resolve(true)
              return
            }
            
            // Try next method
            tryNextMethod()
          }
          
          childProcess.stdout?.on('data', (data) => {
            output += data.toString()
            
            // For version check - look for version patterns or Claude Code mentions
            if (output.includes('Claude Code') || /\d+\.\d+\.\d+/.test(output)) {
              hasValidOutput = true
            }
            
            // For which/where check - any path output means claude is found
            if (currentMethodIndex === 2 && output.trim() && !output.includes('not found')) {
              hasValidOutput = true
            }
          })
          
          childProcess.stderr?.on('data', (data) => {
            output += data.toString()
          })
          
          childProcess.on('close', (code) => {
            const cleanOutput = output
              .replace(/Debugger attached\./g, '')
              .replace(/Waiting for the debugger to disconnect\.\.\./g, '')
              .trim()
            
            const success = hasValidOutput || (code === 0 && cleanOutput && !cleanOutput.includes('not found'))
            finishMethod(success, `code=${code}`)
          })
          
          childProcess.on('error', (error) => {
            finishMethod(false, `error: ${error.message}`)
          })
          
          // Timeout for this method
          setTimeout(() => {
            if (!finished) {
              childProcess.kill()
              finishMethod(false, 'timed out')
            }
          }, 3000)
        }
        
        tryNextMethod()
        
        // Global timeout
        setTimeout(() => {
          resolve(false)
        }, 10000)
      })
    } catch (error) {
      logger.error('Error checking Claude installation', 'pty-manager', error as Error)
      return false
    }
  }

  private setupEventHandlers(): void {
    if (!this.ptyProcess) return
    logger.info('Setting up event handlers for PTY process', 'pty-manager')
    // Handle data from PTY - forward to renderer with session ID
    this.ptyProcess.onData((data: string) => {
      logger.info(`[${this.sessionId}] Received data from PTY: "${data.slice(0, 100)}${data.length > 100 ? '...' : ''}"`, 'pty-manager')
      
      // Check if shell is ready (look for common shell prompts)
      if (!this.shellReady && this.isShellReady(data)) {
        this.shellReady = true
        logger.info(`[${this.sessionId}] Shell is ready`, 'pty-manager')
        
        // Start Claude if auto-start is enabled and Claude is installed
        if (this.shouldAutoStartClaude && this.claudeInstalled) {
          this.isClaudeStarting = true
          logger.info(`[${this.sessionId}] Starting Claude CLI automatically...`, 'pty-manager')
          setTimeout(() => {
            this.startClaudeInShell()
          }, 500) // Small delay to let shell fully initialize
        }
      }

      if (this.isClaudeStarting) {
        // Buffer output while claude-code is starting
        this.pendingOutput.push(data)
        logger.info(`[${this.sessionId}] Buffering output while Claude starting, buffer size: ${this.pendingOutput.length}`, 'pty-manager')
        
        // Check if claude-code has started (look for specific prompt patterns)
        if (this.isClaudeReady(data)) {
          logger.info(`[${this.sessionId}] Claude-code ready, sending buffered output`, 'pty-manager')
          this.isClaudeStarting = false
          
          // Send welcome message first
          const welcomeData = {
            sessionId: this.sessionId,
            data: '\x1b[36mCC Copilot Terminal\x1b[0m\r\n' +
                  '\x1b[32m✓ Claude Code Ready\x1b[0m\r\n\r\n'
          }
          logger.info(`[${this.sessionId}] Sending welcome message to renderer`, 'pty-manager')
          this.mainWindow?.webContents.send('terminal:data', welcomeData)
          
          // Send buffered output
          const bufferedData = this.pendingOutput.join('')
          const bufferedOutput = {
            sessionId: this.sessionId,
            data: bufferedData
          }
          logger.info(`[${this.sessionId}] Sending buffered output (${bufferedData.length} chars) to renderer`, 'pty-manager')
          this.mainWindow?.webContents.send('terminal:data', bufferedOutput)
          this.pendingOutput = []
        }
      } else {
        // Normal operation - forward data immediately
        const outputData = {
          sessionId: this.sessionId,
          data
        }
        logger.info(`[${this.sessionId}] Sending data immediately to renderer (${data.length} chars)`, 'pty-manager')
        this.mainWindow?.webContents.send('terminal:data', outputData)
      }
    })

    // Handle PTY exit
    this.ptyProcess.onExit((exitCode) => {
      logger.error(`PTY process exited with code: ${exitCode.exitCode}, signal: ${exitCode.signal} for session ${this.sessionId}`, 'pty-manager')
      
      // Log additional information for debugging
      if (exitCode.exitCode === 1) {
        logger.error('PTY process failed to start - possible causes:', 'pty-manager')
        logger.error('1. Working directory does not exist or is not accessible', 'pty-manager')
        logger.error('2. Shell binary not found or not executable', 'pty-manager')
        logger.error('3. Environment variables cause shell initialization failure', 'pty-manager')
        logger.error('4. Permission issues', 'pty-manager')
      }
      
      this.ptyProcess = null
      this.isClaudeStarting = false
      this.shellReady = false
      
      this.mainWindow?.webContents.send('terminal:data', {
        sessionId: this.sessionId,
        data: `\r\n[Process exited with code ${exitCode.exitCode}${exitCode.signal ? `, signal: ${exitCode.signal}` : ''}]\r\n`
      })
    })
  }

  private sendInitialMessage(): void {
    // Send initial message only for manual terminal sessions
    // Auto-start Claude sessions will show their own messages
    if (!this.isClaudeStarting) {
      setTimeout(() => {
        if (this.ptyProcess) {
          let message = '\x1b[36mCC Copilot Terminal Ready\x1b[0m\r\n' +
                       '\x1b[32m✓ Connected to real terminal\x1b[0m\r\n' +
                       '\x1b[90mType commands or start claude-code with: npx @anthropic-ai/claude-code\x1b[0m\r\n\r\n'
          
          this.mainWindow?.webContents.send('terminal:data', {
            sessionId: this.sessionId,
            data: message
          })
        }
      }, 100)
    }
    // For auto-starting claude sessions, we'll show messages based on Claude availability
  }
}