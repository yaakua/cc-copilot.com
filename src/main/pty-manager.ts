import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import * as os from 'os'
import * as path from 'path'

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

  constructor(mainWindow: BrowserWindow, sessionId: string) {
    this.mainWindow = mainWindow
    this.sessionId = sessionId
    this.currentEnv = { ...process.env }
  }

  public async start(options: PtyOptions = {}): Promise<void> {
    if (this.ptyProcess) {
      console.log('[PTY] Process already running')
      return
    }

    try {
      console.log('[PTY] Starting process...')
      
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
      
      if (options.autoStartClaude) {
        // Start claude-code directly without showing the startup process
        if (os.platform() === 'win32') {
          shell = 'powershell.exe'
          shellArgs = ['-Command', 'npx @anthropic-ai/claude-code']
        } else {
          shell = 'bash'
          shellArgs = ['-c', 'npx @anthropic-ai/claude-code']
        }
      } else {
        // Start normal shell
        shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'
        shellArgs = []
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
      console.log('[PTY] Process started successfully')
      
      // Send initial welcome message
      this.sendInitialMessage()
      
      // Set flag if claude-code is starting directly
      if (options.autoStartClaude) {
        this.isClaudeStarting = true
        console.log('[PTY] Starting claude-code directly via PTY spawn')
      }
    } catch (error) {
      console.error('[PTY] Failed to start:', error)
      throw error
    }
  }

  public async stop(): Promise<void> {
    if (!this.ptyProcess) {
      console.log('[PTY] No process to stop')
      return
    }

    console.log('[PTY] Stopping process...')
    
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
      console.error('[PTY] Error during stop:', error)
    } finally {
      this.ptyProcess = null
      console.log('[PTY] Process stopped')
    }
  }

  public sendInput(data: string): void {
    if (this.ptyProcess) {
      this.ptyProcess.write(data)
    } else {
      console.warn('[PTY] Cannot send input - process not running')
    }
  }

  public resize(cols: number, rows: number): void {
    if (this.ptyProcess) {
      this.ptyProcess.resize(cols, rows)
      console.log(`[PTY] Resized to ${cols}x${rows}`)
    } else {
      console.warn('[PTY] Cannot resize - process not running')
    }
  }

  public changeDirectory(directory: string): void {
    if (!this.ptyProcess) {
      console.warn('[PTY] Cannot change directory - process not running')
      return
    }

    const resolvedPath = path.resolve(directory)
    const command = os.platform() === 'win32' 
      ? `cd "${resolvedPath}"\r\n`
      : `cd "${resolvedPath}"\n`
    
    console.log(`[PTY] Changing directory to: ${resolvedPath}`)
    this.ptyProcess.write(command)
  }

  public setEnvironmentVariable(key: string, value: string): void {
    this.currentEnv[key] = value
    
    if (!this.ptyProcess) {
      console.log(`[PTY] Environment variable ${key} set for next session`)
      return
    }

    // Set environment variable in current session
    const command = os.platform() === 'win32'
      ? `$env:${key}="${value}"\r\n`
      : `export ${key}="${value}"\n`
    
    console.log(`[PTY] Setting environment variable: ${key}=${value}`)
    this.ptyProcess.write(command)
  }

  public getEnvironmentVariable(key: string): string | undefined {
    return this.currentEnv[key]
  }

  public getAllEnvironmentVariables(): Record<string, string|undefined> {
    return { ...this.currentEnv }
  }

  public startClaudeCode(workingDirectory?: string): void {
    if (!this.ptyProcess) {
      console.warn('[PTY] Cannot start claude-code - process not running')
      return
    }

    // Change to working directory if provided
    if (workingDirectory) {
      this.changeDirectory(workingDirectory)
    }

    // Start claude-code with command write (for manual start)
    const command = os.platform() === 'win32'
      ? 'npx @anthropic-ai/claude-code\r\n'
      : 'npx @anthropic-ai/claude-code\n'
    
    console.log('[PTY] Starting claude-code...')
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
          console.log(`[PTY] Claude-code ready for session ${this.sessionId}`)
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
      console.log(`[PTY] Process exited with code: ${exitCode.exitCode} for session ${this.sessionId}`)
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
          this.mainWindow?.webContents.send('terminal:data', {
            sessionId: this.sessionId,
            data: '\x1b[36mCC Copilot Terminal Ready\x1b[0m\r\n' +
                  '\x1b[32m✓ Connected to real terminal\x1b[0m\r\n' +
                  '\x1b[90mType commands or start claude-code with: npx @anthropic-ai/claude-code\x1b[0m\r\n\r\n'
          })
        }
      }, 100)
    } else {
      // For auto-starting claude, don't send any initial message
      // We'll wait for claude-code to be ready
    }
  }
}