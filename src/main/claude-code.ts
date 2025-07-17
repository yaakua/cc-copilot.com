import { spawn, ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'

export class ClaudeCodeManager {
  private process: ChildProcess | null = null
  private mainWindow: BrowserWindow | null = null

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  public async start(): Promise<void> {
    if (this.process) {
      console.log('[Claude Code] Process already running')
      return
    }

    try {
      console.log('[Claude Code] Starting process...')
      
      // Set environment variable to use our local proxy
      const env = {
        ...process.env,
        ANTHROPIC_BASE_URL: 'http://127.0.0.1:31299'
      }

      // Spawn claude-code process
      this.process = spawn('npx', ['@anthropic-ai/claude-code'], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      })

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

      console.log('[Claude Code] Process started successfully')
    } catch (error) {
      console.error('[Claude Code] Failed to start:', error)
      throw error
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

  public isRunning(): boolean {
    return this.process !== null
  }
}