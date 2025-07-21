import { spawn } from 'child_process'
import * as os from 'os'
import { logger } from './logger'

export interface ClaudeDetectionResult {
  isInstalled: boolean
  version?: string
  path?: string
  error?: string
  timestamp: number
}

export class ClaudeDetector {
  private static instance: ClaudeDetector
  private detectionResult: ClaudeDetectionResult | null = null
  private detecting: boolean = false
  private detectionPromise: Promise<ClaudeDetectionResult> | null = null

  private constructor() {}

  public static getInstance(): ClaudeDetector {
    if (!ClaudeDetector.instance) {
      ClaudeDetector.instance = new ClaudeDetector()
    }
    return ClaudeDetector.instance
  }

  public async detect(forceRedetect: boolean = false): Promise<ClaudeDetectionResult> {
    // 如果已经在检测中，返回现有的Promise
    if (this.detecting && this.detectionPromise) {
      logger.info('Claude检测已在进行中，等待结果...', 'claude-detector')
      return this.detectionPromise
    }

    // 如果已有结果且不强制重新检测，返回缓存结果
    if (this.detectionResult && !forceRedetect) {
      logger.info('使用缓存的Claude检测结果', 'claude-detector', this.detectionResult)
      return this.detectionResult
    }

    this.detecting = true
    this.detectionPromise = this.performDetection()
    
    try {
      this.detectionResult = await this.detectionPromise
      return this.detectionResult
    } finally {
      this.detecting = false
      this.detectionPromise = null
    }
  }

  public getLastResult(): ClaudeDetectionResult | null {
    return this.detectionResult
  }

  public isClaudeAvailable(): boolean {
    return this.detectionResult?.isInstalled === true
  }

  private async performDetection(): Promise<ClaudeDetectionResult> {
    logger.info('开始检测Claude CLI...', 'claude-detector')
    
    const result: ClaudeDetectionResult = {
      isInstalled: false,
      timestamp: Date.now()
    }

    try {
      // 检测方法列表
      const detectMethods = [
        {
          name: 'version-check',
          command: 'claude',
          args: ['--version'],
          env: { ...process.env, NODE_OPTIONS: '', DEBUG: '' }
        },
        {
          name: 'path-check',
          command: os.platform() === 'win32' ? 'where' : 'which',
          args: ['claude'],
          env: process.env
        }
      ]

      for (const method of detectMethods) {
        logger.info(`尝试检测方法: ${method.name}`, 'claude-detector')
        
        const methodResult = await this.runDetectionMethod(method)
        if (methodResult.success) {
          result.isInstalled = true
          result.version = methodResult.version
          result.path = methodResult.path
          logger.info(`Claude CLI检测成功 (${method.name}): ${methodResult.version || 'unknown version'}`, 'claude-detector')
          return result
        }
      }

      result.error = 'Claude CLI未找到或无法执行'
      logger.warn('所有Claude检测方法都失败了', 'claude-detector')
      return result

    } catch (error) {
      result.error = `检测过程中出错: ${(error as Error).message}`
      logger.error('Claude检测过程中发生错误', 'claude-detector', error as Error)
      return result
    }
  }

  private async runDetectionMethod(method: {
    name: string
    command: string
    args: string[]
    env: any
  }): Promise<{
    success: boolean
    version?: string
    path?: string
    error?: string
  }> {
    return new Promise((resolve) => {
      const childProcess = spawn(method.command, method.args, {
        stdio: 'pipe',
        shell: true,
        env: method.env,
        timeout: 5000 // 5秒超时
      })

      let output = ''
      let hasValidOutput = false

      const finishMethod = (success: boolean, reason: string) => {
        const cleanOutput = output
          .replace(/Debugger attached\./g, '')
          .replace(/Waiting for the debugger to disconnect\.\.\./g, '')
          .trim()

        logger.info(`检测方法 ${method.name}: ${reason}, output="${cleanOutput.substring(0, 100)}"`, 'claude-detector')

        if (success) {
          const version = this.extractVersion(cleanOutput)
          const path = method.name === 'path-check' ? cleanOutput : undefined
          
          resolve({
            success: true,
            version,
            path,
          })
        } else {
          resolve({
            success: false,
            error: reason
          })
        }
      }

      childProcess.stdout?.on('data', (data) => {
        output += data.toString()
        
        // 根据检测方法类型判断有效输出
        if (method.name === 'version-check') {
          if (output.includes('Claude Code') || /\d+\.\d+\.\d+/.test(output)) {
            hasValidOutput = true
          }
        } else if (method.name === 'path-check') {
          if (output.trim() && !output.includes('not found') && !output.includes('command not found')) {
            hasValidOutput = true
          }
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
        finishMethod(success as boolean, `exit code=${code}`)
      })

      childProcess.on('error', (error) => {
        finishMethod(false, `spawn error: ${error.message}`)
      })

      // 超时处理
      setTimeout(() => {
        if (!childProcess.killed) {
          childProcess.kill()
          finishMethod(false, 'timeout')
        }
      }, 5000)
    })
  }

  private extractVersion(output: string): string {
    // 尝试从输出中提取版本号
    const versionMatch = output.match(/(\d+\.\d+\.\d+[\w\-\.]*)/i)
    if (versionMatch) {
      return versionMatch[1]
    }
    
    // 如果包含 Claude Code 但没有明确版本号
    if (output.toLowerCase().includes('claude code')) {
      return 'detected'
    }
    
    return 'unknown'
  }

  public async waitForDetection(timeoutMs: number = 30000): Promise<ClaudeDetectionResult> {
    if (!this.detecting && this.detectionResult) {
      return this.detectionResult
    }

    const startTime = Date.now()
    while (this.detecting && (Date.now() - startTime) < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (this.detecting) {
      throw new Error(`Claude检测超时 (${timeoutMs}ms)`)
    }

    if (!this.detectionResult) {
      throw new Error('Claude检测未完成')
    }

    return this.detectionResult
  }
}

// 导出单例实例
export const claudeDetector = ClaudeDetector.getInstance()