import { spawn, ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'
import { join } from 'path'

export class ClaudeCodeManager {
  private process: ChildProcess | null = null
  private mainWindow: BrowserWindow | null = null

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  public async start(workingDirectory?: string): Promise<void> {
    if (this.process) {
      console.log('[Claude Code] Process already running')
      return
    }

    try {
      console.log('[Claude Code] Starting process...')
      if (workingDirectory) {
        console.log('[Claude Code] Working directory:', workingDirectory)
      }
      
      // Set environment variable to use our local proxy
      const env = {
        ...process.env,
        ANTHROPIC_BASE_URL: 'http://127.0.0.1:31299'
      }

      // Try to use local installation first, fallback to npx
      const claudeCodePath = this.getClaudeCodePath()
      const command = claudeCodePath ? 'node' : 'npx'
      const args = claudeCodePath ? [claudeCodePath] : ['@anthropic-ai/claude-code']
      
      // Spawn claude-code process
      this.process = spawn(command, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        cwd: workingDirectory || process.cwd()
      })

      this.setupProcessHandlers()
      console.log('[Claude Code] Process started successfully')
    } catch (error) {
      console.error('[Claude Code] Failed to start:', error)
      console.error('[Claude Code] Error details:', JSON.stringify)
      
      // 检查是否是安装错误
      if (this.isInstallationError(error)) {
        console.log('[Claude Code] Attempting to install...')
        
        try {
          // 尝试自动安装
          await this.installClaudeCode()
          
          // 安装成功后重试启动
          const claudeCodePath = this.getClaudeCodePath()
          const command = claudeCodePath ? 'node' : 'npx'
          const args = claudeCodePath ? [claudeCodePath] : ['@anthropic-ai/claude-code']
          
          this.process = spawn(command, args, {
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: 'http://127.0.0.1:31299'
            },
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true,
            cwd: workingDirectory || process.cwd()
          })
          
          this.setupProcessHandlers()
          console.log('[Claude Code] Process started after installation')
        } catch (installError) {
          console.error('[Claude Code] Installation failed:', installError)
          this.mainWindow?.webContents.send('terminal:output', 
            '\n[Error: Claude Code is not installed. Please install it with: npm install -g @anthropic-ai/claude-code]\n')
          throw new Error('Claude Code installation required')
        }
      } else {
        throw error
      }
    }
  }

  public async stop(): Promise<void> {
    if (!this.process) {
      console.log('[Claude Code] No process to stop')
      return
    }

    return new Promise((resolve) => {
      if (this.process) {
        this.process.on('exit', () => {
          console.log('[Claude Code] Process stopped')
          this.process = null
          resolve()
        })

        // Try graceful shutdown first
        this.process.kill('SIGTERM')

        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (this.process) {
            console.log('[Claude Code] Force killing process')
            this.process.kill('SIGKILL')
          }
        }, 5000)
      } else {
        resolve()
      }
    })
  }

  public sendInput(data: string): void {
    if (this.process && this.process.stdin) {
      this.process.stdin.write(data)
    } else {
      console.warn('[Claude Code] Cannot send input - process not running or stdin not available')
    }
  }

  public changeDirectory(path: string): void {
    if (this.process && this.process.stdin) {
      console.log(`[Claude Code] Changing directory to: ${path}`)
      // Send cd command to claude-code process
      this.process.stdin.write(`cd "${path}"\n`)
    } else {
      console.warn('[Claude Code] Cannot change directory - process not running or stdin not available')
    }
  }

  private async installClaudeCode(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[Claude Code] Installing @anthropic-ai/claude-code locally...')
      
      const installProcess = spawn('npm', ['install', '@anthropic-ai/claude-code'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        cwd: process.cwd() // 确保在应用根目录执行
      })

      installProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        console.log('[Claude Code] Install stdout:', output)
      })

      installProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString()
        console.log('[Claude Code] Install stderr:', output)
      })

      installProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('[Claude Code] Installation completed successfully')
          resolve()
        } else {
          reject(new Error(`Installation failed with code ${code}`))
        }
      })

      installProcess.on('error', (error) => {
        reject(error)
      })
    })
  }

  private setupProcessHandlers(): void {
    if (!this.process) return

    // Handle stdout - forward to renderer
    this.process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      console.log('[Claude Code] stdout:', output)
      this.mainWindow?.webContents.send('terminal:output', output)
    })

    // Handle stderr - forward to renderer
    this.process.stderr?.on('data', (data: Buffer) => {
      const output = data.toString()
      console.log('[Claude Code] stderr:', output)
      this.mainWindow?.webContents.send('terminal:output', output)
    })

    // Send initial welcome message and trigger claude-code prompt
    setTimeout(() => {
      console.log('[Claude Code] Sending welcome message to terminal')
      this.mainWindow?.webContents.send('terminal:output', 
        '\x1b[36mClaude Code is ready!\x1b[0m\r\n' +
        '\x1b[90mYou can now start chatting with Claude.\x1b[0m\r\n\r\n'
      )
      
      // Send initial input to trigger claude-code interactive mode
      if (this.process && this.process.stdin) {
        // Send empty line to get the prompt
        this.process.stdin.write('\r\n')
      }
    }, 1500)

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      console.log(`[Claude Code] Process exited with code ${code}, signal ${signal}`)
      this.process = null
      this.mainWindow?.webContents.send('terminal:output', '\n[Process exited]\n')
    })

    // Handle process error
    this.process.on('error', (error) => {
      console.error('[Claude Code] Process error:', error)
      this.mainWindow?.webContents.send('terminal:output', `\n[Error: ${error.message}]\n`)
    })
  }

  public isRunning(): boolean {
    return this.process !== null
  }

  private getClaudeCodePath(): string | null {
    try {
      // 检查本地安装的 claude-code
      const localPath = join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-code', 'dist', 'index.js')
      const fs = require('fs')
      
      if (fs.existsSync(localPath)) {
        console.log('[Claude Code] Found local installation at:', localPath)
        return localPath
      }
      
      console.log('[Claude Code] Local installation not found, will use npx')
      return null
    } catch (error) {
      console.error('[Claude Code] Error checking local installation:', error)
      return null
    }
  }

  private isInstallationError(error: any): boolean {
    if (!error) return false
    
    const errorMessage = error.message?.toLowerCase() || ''
    const errorCode = error.code
    
    // Check for common installation error patterns
    return (
      errorCode === 'ENOENT' ||
      errorMessage.includes('not found') ||
      errorMessage.includes('command not found') ||
      errorMessage.includes('spawn enoent') ||
      errorMessage.includes('no such file') ||
      (errorMessage.includes('npx') && errorMessage.includes('failed'))
    )
  }
}