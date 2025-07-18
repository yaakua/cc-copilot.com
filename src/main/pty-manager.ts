import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import * as os from 'os'
import * as path from 'path'

export interface PtyOptions {
  workingDirectory?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export class PtyManager {
  private ptyProcess: pty.IPty | null = null
  private mainWindow: BrowserWindow | null = null
  private currentEnv: Record<string, string> = {}

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
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

      // Determine shell based on platform
      const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'
      
      // Create PTY process
      this.ptyProcess = pty.spawn(shell, [], {
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

  public getAllEnvironmentVariables(): Record<string, string> {
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

    // Start claude-code with environment variables
    const command = os.platform() === 'win32'
      ? 'npx @anthropic-ai/claude-code\r\n'
      : 'npx @anthropic-ai/claude-code\n'
    
    console.log('[PTY] Starting claude-code...')
    this.ptyProcess.write(command)
  }

  public isRunning(): boolean {
    return this.ptyProcess !== null
  }

  private setupEventHandlers(): void {
    if (!this.ptyProcess) return

    // Handle data from PTY - forward to renderer
    this.ptyProcess.onData((data: string) => {
      this.mainWindow?.webContents.send('terminal:data', data)
    })

    // Handle PTY exit
    this.ptyProcess.onExit((exitCode) => {
      console.log(`[PTY] Process exited with code: ${exitCode.exitCode}`)
      this.ptyProcess = null
      this.mainWindow?.webContents.send('terminal:data', 
        `\r\n[Process exited with code ${exitCode.exitCode}]\r\n`)
    })
  }

  private sendInitialMessage(): void {
    // Send welcome message after a short delay
    setTimeout(() => {
      if (this.ptyProcess) {
        this.mainWindow?.webContents.send('terminal:data', 
          '\x1b[36mCC Copilot Terminal Ready\x1b[0m\r\n' +
          '\x1b[32m✓ Connected to real terminal\x1b[0m\r\n' +
          '\x1b[90mType commands or start claude-code with: npx @anthropic-ai/claude-code\x1b[0m\r\n\r\n'
        )
      }
    }, 100)
  }
}