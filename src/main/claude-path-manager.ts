import { spawn } from 'child_process'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from './logger'

export interface ClaudePathResult {
  isFound: boolean
  path?: string
  version?: string
  error?: string
  timestamp: number
}

/**
 * 统一的Claude路径管理器
 * 在应用启动时检测并缓存Claude CLI的路径，供其他模块使用
 */
export class ClaudePathManager {
  private static instance: ClaudePathManager
  private cachedResult: ClaudePathResult | null = null
  private detecting = false
  private detectionPromise: Promise<ClaudePathResult> | null = null

  private constructor() {}

  public static getInstance(): ClaudePathManager {
    if (!ClaudePathManager.instance) {
      ClaudePathManager.instance = new ClaudePathManager()
    }
    return ClaudePathManager.instance
  }

  /**
   * 获取Claude CLI路径，如果未检测过则先进行检测
   */
  public async getClaudePath(): Promise<string | null> {
    const result = await this.detectClaudePath()
    return result.isFound ? result.path || null : null
  }

  /**
   * 检测Claude CLI路径并缓存结果
   */
  public async detectClaudePath(forceRedetect = false): Promise<ClaudePathResult> {
    // 如果正在检测中，等待现有检测完成
    if (this.detecting && this.detectionPromise) {
      logger.info('Claude路径检测已在进行中，等待结果...', 'claude-path-manager')
      return this.detectionPromise
    }

    // 如果有缓存结果且不强制重新检测，返回缓存
    if (this.cachedResult && !forceRedetect) {
      logger.info('使用缓存的Claude路径检测结果', 'claude-path-manager', this.cachedResult)
      return this.cachedResult
    }

    this.detecting = true
    this.detectionPromise = this.performDetection()

    try {
      this.cachedResult = await this.detectionPromise
      return this.cachedResult
    } finally {
      this.detecting = false
      this.detectionPromise = null
    }
  }

  /**
   * 获取缓存的检测结果
   */
  public getCachedResult(): ClaudePathResult | null {
    return this.cachedResult
  }

  /**
   * 清除缓存，强制下次重新检测
   */
  public clearCache(): void {
    this.cachedResult = null
    logger.info('Claude路径缓存已清除', 'claude-path-manager')
  }

  private async performDetection(): Promise<ClaudePathResult> {
    logger.info('开始检测Claude CLI路径...', 'claude-path-manager')

    const result: ClaudePathResult = {
      isFound: false,
      timestamp: Date.now()
    }

    try {
      // 1. 优先进行直接文件系统检查
      const directPath = await this.directFileSystemCheck()
      if (directPath) {
        logger.info(`通过直接文件检查找到Claude: ${directPath}`, 'claude-path-manager')
        result.isFound = true
        result.path = directPath
        result.version = await this.getVersionSafely(directPath)
        return result
      }

      // 2. 使用which/where命令查找
      const whichPath = await this.findWithWhichCommand()
      if (whichPath) {
        logger.info(`通过which/where命令找到Claude: ${whichPath}`, 'claude-path-manager')
        result.isFound = true
        result.path = whichPath
        result.version = await this.getVersionSafely(whichPath)
        return result
      }

      result.error = '在所有已知路径和PATH中都未找到Claude CLI'
      logger.warn(result.error, 'claude-path-manager')
      return result

    } catch (error) {
      result.error = `检测过程中出错: ${(error as Error).message}`
      logger.error('Claude路径检测过程中发生错误', 'claude-path-manager', error as Error)
      return result
    }
  }

  private async directFileSystemCheck(): Promise<string | null> {
    const possiblePaths = [
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      '/usr/bin/claude',
      '/bin/claude',
      path.join(process.env.HOME || '', '.local/bin/claude'),
      path.join(process.env.HOME || '', 'bin/claude'),
      '/opt/local/bin/claude'
    ]

    // macOS特定路径
    if (os.platform() === 'darwin') {
      possiblePaths.push(
        '/usr/local/lib/node_modules/.bin/claude',
        '/opt/homebrew/lib/node_modules/.bin/claude',
        path.join(process.env.HOME || '', '.npm-global/bin/claude'),
        path.join(process.env.HOME || '', 'Applications/claude')
      )
    }

    // Windows路径
    if (os.platform() === 'win32') {
      possiblePaths.push(
        'C:\\Program Files\\nodejs\\claude.exe',
        path.join('C:\\Users', process.env.USERNAME || 'User', 'AppData\\Local\\npm\\claude.exe'),
        path.join('C:\\Users', process.env.USERNAME || 'User', 'AppData\\Roaming\\npm\\claude.exe')
      )
    }

    // 展开通配符路径并检查所有可能的路径
    const expandedPaths = await this.expandWildcardPaths(possiblePaths)

    for (const claudePath of expandedPaths) {
      try {
        const stats = await fs.promises.stat(claudePath)
        if (stats.isFile()) {
          // 检查执行权限 (在Unix系统上)
          if (os.platform() !== 'win32') {
            try {
              await fs.promises.access(claudePath, fs.constants.X_OK)
            } catch {
              logger.debug(`文件存在但无执行权限: ${claudePath}`, 'claude-path-manager')
              continue
            }
          }
          return claudePath
        }
      } catch {
        // 文件不存在或无法访问，继续检查下一个路径
        continue
      }
    }

    return null
  }

  private async expandWildcardPaths(paths: string[]): Promise<string[]> {
    const expandedPaths: string[] = []
    
    for (const pathPattern of paths) {
      if (pathPattern.includes('*')) {
        try {
          // 简单的通配符展开（主要处理nvm路径）
          const parts = pathPattern.split('*')
          if (parts.length === 3) {
            const prefix = parts[0]
            const suffix = parts[2]
            
            try {
              const middleDir = path.dirname(prefix + 'dummy' + suffix)
              const parentDir = path.dirname(middleDir)
              
              if (await this.directoryExists(parentDir)) {
                const entries = await fs.promises.readdir(parentDir)
                for (const entry of entries) {
                  const candidatePath = path.join(parentDir, entry, path.basename(suffix))
                  if (await this.fileExists(candidatePath)) {
                    expandedPaths.push(candidatePath)
                  }
                }
              }
            } catch {
              // 忽略展开失败的路径
            }
          }
        } catch {
          // 忽略通配符展开失败
        }
      } else {
        expandedPaths.push(pathPattern)
      }
    }
    
    return expandedPaths
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(dirPath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(filePath)
      return stats.isFile()
    } catch {
      return false
    }
  }

  private async findWithWhichCommand(): Promise<string | null> {
    const expandedEnv = this.getExpandedEnvironment()
    const command = os.platform() === 'win32' ? 'where' : 'which'

    return new Promise((resolve) => {
      const childProcess = spawn(command, ['claude'], {
        shell: true,
        env: expandedEnv,
        stdio: 'pipe'
      })

      let outputPath = ''
      
      childProcess.stdout?.on('data', (data) => {
        outputPath += data.toString()
      })

      childProcess.on('close', (code) => {
        if (code === 0 && outputPath.trim()) {
          // 获取第一行结果并去除换行符
          const foundPath = outputPath.split(/[\r\n]+/)[0].trim()
          resolve(foundPath || null)
        } else {
          resolve(null)
        }
      })

      childProcess.on('error', () => {
        resolve(null)
      })
    })
  }

  private getExpandedEnvironment(): NodeJS.ProcessEnv {
    const env = { ...process.env }
    
    // 常见的二进制文件安装路径
    const commonPaths = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin',
      process.env.HOME + '/.local/bin',
      process.env.HOME + '/bin',
      process.env.HOME + '/.bun/bin',
      '/opt/local/bin'
    ].filter(Boolean)

    // 如果是Windows，添加Windows特有路径
    if (os.platform() === 'win32') {
      commonPaths.push(
        'C:\\Program Files\\nodejs',
        'C:\\Users\\' + (process.env.USERNAME || 'User') + '\\AppData\\Local\\npm',
        'C:\\Users\\' + (process.env.USERNAME || 'User') + '\\AppData\\Roaming\\npm'
      )
    }

    // 扩展PATH
    const currentPath = env.PATH || env.Path || ''
    const expandedPath = [currentPath, ...commonPaths].filter(Boolean).join(os.platform() === 'win32' ? ';' : ':')
    
    env.PATH = expandedPath
    if (os.platform() === 'win32') {
      env.Path = expandedPath
    }

    return env
  }

  private async getVersionSafely(claudePath: string): Promise<string> {
    try {
      return new Promise((resolve) => {
        const childProcess = spawn(claudePath, ['--version'], {
          stdio: 'pipe',
          timeout: 5000
        })

        let output = ''

        childProcess.stdout?.on('data', (data) => {
          output += data.toString()
        })

        childProcess.stderr?.on('data', (data) => {
          output += data.toString()
        })

        childProcess.on('close', (code) => {
          if (code === 0 && output) {
            const version = this.extractVersion(output)
            resolve(version)
          } else {
            resolve('detected')
          }
        })

        childProcess.on('error', () => {
          resolve('detected')
        })
      })
    } catch {
      return 'detected'
    }
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
}

// 导出单例实例
export const claudePathManager = ClaudePathManager.getInstance()