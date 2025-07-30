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

export enum InstallationType {
  System = 'system',
  Custom = 'custom'
}

export interface ClaudeInstallation {
  path: string
  version?: string
  source: string
  installationType: InstallationType
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
    logger.info('开始获取Claude CLI路径...', 'claude-path-manager')
    
    const result = await this.detectClaudePath()
    
    if (result.isFound && result.path) {
      logger.info(`成功获取Claude路径: ${result.path}`, 'claude-path-manager')
      return result.path
    } else {
      logger.error(`获取Claude路径失败: ${result.error || '未知错误'}`, 'claude-path-manager')
      logger.error(`检测结果详情: isFound=${result.isFound}, path=${result.path || 'null'}, version=${result.version || 'unknown'}`, 'claude-path-manager')
      return null
    }
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
      logger.info('开始发现所有可用的Claude安装...', 'claude-path-manager')
      // 发现所有可用的Claude安装
      const installations = await this.discoverAllInstallations()
      
      logger.info(`发现Claude安装数量: ${installations.length}`, 'claude-path-manager')
      
      if (installations.length === 0) {
        result.error = '在所有已知路径中都未找到Claude CLI'
        logger.warn(result.error, 'claude-path-manager')
        return result
      }

      // 记录所有找到的安装
      for (const installation of installations) {
        logger.info(`找到Claude安装: path=${installation.path}, version=${installation.version || 'unknown'}, source=${installation.source}`, 'claude-path-manager')
      }

      // 选择最佳安装
      logger.info('开始选择最佳Claude安装...', 'claude-path-manager')
      const bestInstallation = this.selectBestInstallation(installations)
      if (bestInstallation) {
        logger.info(`选择Claude安装: path=${bestInstallation.path}, version=${bestInstallation.version || 'unknown'}, source=${bestInstallation.source}`, 'claude-path-manager')
        result.isFound = true
        result.path = bestInstallation.path
        result.version = bestInstallation.version
        logger.info('Claude路径检测完成，找到有效安装', 'claude-path-manager')
        return result
      }

      result.error = '未找到有效的Claude CLI安装'
      logger.warn(result.error, 'claude-path-manager')
      return result

    } catch (error) {
      result.error = `检测过程中出错: ${(error as Error).message}`
      logger.error('Claude路径检测过程中发生错误', 'claude-path-manager', error as Error)
      return result
    }
  }

  private async discoverAllInstallations(): Promise<ClaudeInstallation[]> {
    const installations: ClaudeInstallation[] = []
    logger.info('开始发现所有Claude安装...', 'claude-path-manager')

    // 1. 尝试which命令
    logger.info('步骤1: 尝试使用which/where命令查找Claude...', 'claude-path-manager')
    const whichInstallation = await this.tryWhichCommand()
    if (whichInstallation) {
      logger.info(`which命令找到Claude: ${whichInstallation.path}`, 'claude-path-manager')
      installations.push(whichInstallation)
    } else {
      logger.info('which命令未找到Claude', 'claude-path-manager')
    }

    // 2. 检查NVM路径
    logger.info('步骤2: 检查NVM路径中的Claude...', 'claude-path-manager')
    const nvmInstallations = await this.findNvmInstallations()
    logger.info(`NVM路径中找到Claude安装数量: ${nvmInstallations.length}`, 'claude-path-manager')
    installations.push(...nvmInstallations)

    // 3. 检查标准路径
    logger.info('步骤3: 检查标准路径中的Claude...', 'claude-path-manager')
    const standardInstallations = await this.findStandardInstallations()
    logger.info(`标准路径中找到Claude安装数量: ${standardInstallations.length}`, 'claude-path-manager')
    installations.push(...standardInstallations)

    // 4. 检查PATH中的claude命令
    logger.info('步骤4: 检查PATH中的claude命令...', 'claude-path-manager')
    const pathInstallation = await this.checkPathCommand()
    if (pathInstallation) {
      logger.info(`PATH中找到Claude: ${pathInstallation.path}`, 'claude-path-manager')
      installations.push(pathInstallation)
    } else {
      logger.info('PATH中未找到Claude', 'claude-path-manager')
    }

    // 去重（按路径）
    const uniquePaths = new Set<string>()
    const filteredInstallations = installations.filter(install => {
      if (uniquePaths.has(install.path)) {
        logger.debug(`跳过重复的Claude安装: ${install.path}`, 'claude-path-manager')
        return false
      }
      uniquePaths.add(install.path)
      return true
    })

    logger.info(`去重后Claude安装总数: ${filteredInstallations.length}`, 'claude-path-manager')
    return filteredInstallations
  }

  private async tryWhichCommand(): Promise<ClaudeInstallation | null> {
    logger.debug('尝试使用which命令查找Claude...', 'claude-path-manager')
    
    const command = os.platform() === 'win32' ? 'where' : 'which'
    const expandedEnv = this.getExpandedEnvironment()

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

      childProcess.on('close', async (code) => {
        if (code === 0 && outputPath.trim()) {
          const output = outputPath.trim()
          
          // 处理别名输出: "claude: aliased to /path/to/claude"
          let claudePath: string
          if (output.includes('aliased to')) {
            const match = output.match(/aliased to\s+(.+)$/)
            if (match) {
              claudePath = match[1].trim()
            } else {
              resolve(null)
              return
            }
          } else {
            claudePath = output.split(/[\r\n]+/)[0].trim()
          }

          // 验证路径存在
          if (!await this.fileExists(claudePath)) {
            logger.warn(`which命令返回的路径不存在: ${claudePath}`, 'claude-path-manager')
            resolve(null)
            return
          }

          const version = await this.getVersionSafely(claudePath)
          resolve({
            path: claudePath,
            version: version !== 'detected' && version !== 'unknown' ? version : undefined,
            source: 'which',
            installationType: InstallationType.System
          })
        } else {
          resolve(null)
        }
      })

      childProcess.on('error', () => {
        resolve(null)
      })
    })
  }

  private async findNvmInstallations(): Promise<ClaudeInstallation[]> {
    const installations: ClaudeInstallation[] = []
    const homeDir = process.env.HOME
    
    if (!homeDir) {
      return installations
    }

    const nvmDir = path.join(homeDir, '.nvm', 'versions', 'node')
    logger.debug(`检查NVM目录: ${nvmDir}`, 'claude-path-manager')

    if (!await this.directoryExists(nvmDir)) {
      return installations
    }

    try {
      const entries = await fs.promises.readdir(nvmDir)
      
      for (const entry of entries) {
        const entryPath = path.join(nvmDir, entry)
        const stats = await fs.promises.stat(entryPath).catch(() => null)
        
        if (stats?.isDirectory()) {
          const claudePath = path.join(entryPath, 'bin', 'claude')
          
          if (await this.fileExists(claudePath)) {
            logger.debug(`在NVM节点${entry}中找到Claude: ${claudePath}`, 'claude-path-manager')
            
            const version = await this.getVersionSafely(claudePath)
            installations.push({
              path: claudePath,
              version: version !== 'detected' && version !== 'unknown' ? version : undefined,
              source: `nvm (${entry})`,
              installationType: InstallationType.System
            })
          }
        }
      }
    } catch (error) {
      logger.debug(`读取NVM目录失败: ${error}`, 'claude-path-manager')
    }

    return installations
  }

  private async findStandardInstallations(): Promise<ClaudeInstallation[]> {
    const installations: ClaudeInstallation[] = []
    const homeDir = process.env.HOME

    const pathsToCheck: Array<{path: string, source: string}> = [
      { path: '/usr/local/bin/claude', source: 'system' },
      { path: '/opt/homebrew/bin/claude', source: 'homebrew' },
      { path: '/usr/bin/claude', source: 'system' },
      { path: '/bin/claude', source: 'system' }
    ]

    // 用户特定路径
    if (homeDir) {
      pathsToCheck.push(
        { path: path.join(homeDir, '.claude/local/claude'), source: 'claude-local' },
        { path: path.join(homeDir, '.local/bin/claude'), source: 'local-bin' },
        { path: path.join(homeDir, '.npm-global/bin/claude'), source: 'npm-global' },
        { path: path.join(homeDir, '.yarn/bin/claude'), source: 'yarn' },
        { path: path.join(homeDir, '.bun/bin/claude'), source: 'bun' },
        { path: path.join(homeDir, 'bin/claude'), source: 'home-bin' },
        { path: path.join(homeDir, 'node_modules/.bin/claude'), source: 'node-modules' },
        { path: path.join(homeDir, '.config/yarn/global/node_modules/.bin/claude'), source: 'yarn-global' }
      )
    }

    for (const {path: claudePath, source} of pathsToCheck) {
      if (await this.fileExists(claudePath)) {
        logger.debug(`在标准路径找到Claude: ${claudePath} (${source})`, 'claude-path-manager')
        
        const version = await this.getVersionSafely(claudePath)
        installations.push({
          path: claudePath,
          version: version !== 'detected' && version !== 'unknown' ? version : undefined,
          source,
          installationType: InstallationType.System
        })
      }
    }

    return installations
  }

  private async checkPathCommand(): Promise<ClaudeInstallation | null> {
    // 检查claude命令是否在PATH中可用
    return new Promise((resolve) => {
      const childProcess = spawn('claude', ['--version'], {
        stdio: 'pipe',
        env: this.getExpandedEnvironment()
      })

      let output = ''

      childProcess.stdout?.on('data', (data) => {
        output += data.toString()
      })

      childProcess.stderr?.on('data', (data) => {
        output += data.toString()
      })

      childProcess.on('close', (code) => {
        if (code === 0) {
          logger.debug('claude命令在PATH中可用', 'claude-path-manager')
          const version = this.extractVersion(output)
          resolve({
            path: 'claude',
            version: version !== 'detected' && version !== 'unknown' ? version : undefined,
            source: 'PATH',
            installationType: InstallationType.System
          })
        } else {
          resolve(null)
        }
      })

      childProcess.on('error', () => {
        resolve(null)
      })
    })
  }

  private selectBestInstallation(installations: ClaudeInstallation[]): ClaudeInstallation | null {
    if (installations.length === 0) {
      return null
    }

    // 按版本和来源优先级排序
    const sorted = installations.sort((a, b) => {
      // 首先比较版本
      if (a.version && b.version) {
        const versionComparison = this.compareVersions(a.version, b.version)
        if (versionComparison !== 0) {
          return versionComparison > 0 ? -1 : 1 // 版本高的优先
        }
      } else if (a.version && !b.version) {
        return -1 // 有版本信息的优先
      } else if (!a.version && b.version) {
        return 1
      }

      // 版本相同或都没有版本，按来源优先级
      const aPriority = this.getSourcePriority(a.source)
      const bPriority = this.getSourcePriority(b.source)
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority // 优先级数字小的优先
      }

      // 最后，避免选择仅仅是"claude"的PATH查找结果
      if (a.path === 'claude' && b.path !== 'claude') {
        return 1
      } else if (a.path !== 'claude' && b.path === 'claude') {
        return -1
      }

      return 0
    })

    return sorted[0]
  }

  private getSourcePriority(source: string): number {
    const priorities: Record<string, number> = {
      'which': 1,
      'homebrew': 2,
      'system': 3,
      'local-bin': 5,
      'claude-local': 6,
      'npm-global': 7,
      'yarn': 8,
      'yarn-global': 8,
      'bun': 9,
      'node-modules': 10,
      'home-bin': 11,
      'PATH': 12
    }

    // NVM sources
    if (source.startsWith('nvm')) {
      return 4
    }

    return priorities[source] || 13
  }

  private compareVersions(version1: string, version2: string): number {
    const parseVersion = (v: string) => {
      return v.split('.').map(part => {
        // 处理像"1.0.17-beta"这样的版本，只取数字部分
        const numMatch = part.match(/^\d+/)
        return numMatch ? parseInt(numMatch[0], 10) : 0
      })
    }

    const v1Parts = parseVersion(version1)
    const v2Parts = parseVersion(version2)
    const maxLength = Math.max(v1Parts.length, v2Parts.length)

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0
      const v2Part = v2Parts[i] || 0
      
      if (v1Part !== v2Part) {
        return v1Part - v2Part
      }
    }

    return 0
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


  private getExpandedEnvironment(): NodeJS.ProcessEnv {
    const env = { ...process.env }
    
    // 继承关键环境变量
    const essentialEnvVars = [
      'PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'NODE_PATH', 
      'NVM_DIR', 'NVM_BIN', 'HOMEBREW_PREFIX', 'HOMEBREW_CELLAR'
    ]
    
    // 确保关键变量被继承
    for (const [key, value] of Object.entries(process.env)) {
      if (essentialEnvVars.includes(key) || key.startsWith('LC_')) {
        if (value) {
          env[key] = value
        }
      }
    }
    
    // 常见的二进制文件安装路径
    const commonPaths = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin',
      process.env.HOME + '/.local/bin',
      process.env.HOME + '/bin',
      process.env.HOME + '/.bun/bin',
      process.env.HOME + '/.npm-global/bin',
      process.env.HOME + '/.yarn/bin',
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