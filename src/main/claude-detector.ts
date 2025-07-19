import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

const execAsync = promisify(exec)

export interface ClaudeDetectionResult {
  isInstalled: boolean
  installations: ClaudeInstallation[]
  defaultPath?: string
  error?: string
}

export interface ClaudeInstallation {
  id: string
  name: string
  path: string
  version?: string
  type: 'global' | 'local' | 'binary'
  valid: boolean
}

export class ClaudeDetector {
  private static instance: ClaudeDetector
  private cachedResult: ClaudeDetectionResult | null = null
  private cacheExpiry: number = 0
  private readonly CACHE_DURATION = 30000 // 30 seconds

  public static getInstance(): ClaudeDetector {
    if (!ClaudeDetector.instance) {
      ClaudeDetector.instance = new ClaudeDetector()
    }
    return ClaudeDetector.instance
  }

  /**
   * Detect Claude installation by checking .claude directory existence
   */
  public async detectClaude(): Promise<ClaudeDetectionResult> {
    // Return cached result if still valid
    if (this.cachedResult && Date.now() < this.cacheExpiry) {
      return this.cachedResult
    }

    try {
      // Primary check: .claude directory existence
      const claudeDir = path.join(os.homedir(), '.claude')
      const hasClaude = fs.existsSync(claudeDir)

      if (!hasClaude) {
        const result: ClaudeDetectionResult = {
          isInstalled: false,
          installations: []
        }
        
        this.cachedResult = result
        this.cacheExpiry = Date.now() + this.CACHE_DURATION
        return result
      }

      // If .claude exists, try to find actual executable and get version
      const installations = await this.findClaudeExecutables()

      const result: ClaudeDetectionResult = {
        isInstalled: true,
        installations,
        defaultPath: this.selectDefaultInstallation(installations)
      }

      // Cache the result
      this.cachedResult = result
      this.cacheExpiry = Date.now() + this.CACHE_DURATION

      return result
    } catch (error) {
      const result: ClaudeDetectionResult = {
        isInstalled: false,
        installations: [],
        error: error instanceof Error ? error.message : 'Unknown error during detection'
      }
      
      this.cachedResult = result
      this.cacheExpiry = Date.now() + this.CACHE_DURATION
      
      return result
    }
  }

  /**
   * Find Claude executables using various strategies
   */
  private async findClaudeExecutables(): Promise<ClaudeInstallation[]> {
    const installations: ClaudeInstallation[] = []
    
    // Strategy 1: Use 'which' command (Unix/Linux/macOS) or 'where' (Windows)
    const whichInstall = await this.findClaudeWithWhich()
    if (whichInstall) {
      installations.push(whichInstall)
    }

    // Strategy 2: Check common installation directories
    const commonInstalls = await this.checkCommonDirectories()
    installations.push(...commonInstalls)

    // Strategy 3: Check NPX global
    const npxInstall = await this.checkGlobalNpx()
    if (npxInstall) {
      installations.push(npxInstall)
    }

    // Remove duplicates and validate
    const uniqueInstallations = this.removeDuplicateInstallations(installations)
    
    for (const installation of uniqueInstallations) {
      installation.valid = await this.validateClaudeInstallation(installation.path)
      if (installation.valid) {
        installation.version = await this.getClaudeVersion(installation.path)
      }
    }

    return uniqueInstallations
  }

  /**
   * Find Claude using which/where command
   */
  private async findClaudeWithWhich(): Promise<ClaudeInstallation | null> {
    try {
      const isWindows = os.platform() === 'win32'
      const command = isWindows ? 'where claude' : 'which claude'
      
      const { stdout } = await execAsync(command)
      const claudePath = stdout.trim().split('\n')[0] // Take first result
      
      if (claudePath) {
        return {
          id: 'which-claude',
          name: `Claude CLI (${claudePath})`,
          path: claudePath,
          type: 'binary',
          valid: false // Will be validated later
        }
      }
    } catch {
      // Command not found or error
    }
    return null
  }

  /**
   * Check common installation directories
   */
  private async checkCommonDirectories(): Promise<ClaudeInstallation[]> {
    const installations: ClaudeInstallation[] = []
    const homeDir = os.homedir()
    
    const commonPaths = os.platform() === 'win32' 
      ? [
          path.join(homeDir, '.cargo', 'bin', 'claude.exe'),
          path.join(homeDir, '.local', 'share', 'pnpm', 'claude.exe'),
          path.join(homeDir, 'AppData', 'Roaming', 'npm', 'claude.cmd')
        ]
      : [
          path.join(homeDir, '.cargo', 'bin', 'claude'),
          path.join(homeDir, '.local', 'share', 'pnpm', 'claude'),
          '/usr/local/bin/claude',
          '/usr/bin/claude'
        ]

    for (const claudePath of commonPaths) {
      if (fs.existsSync(claudePath)) {
        installations.push({
          id: `common-${path.basename(claudePath)}`,
          name: `Claude CLI (${claudePath})`,
          path: claudePath,
          type: 'binary',
          valid: false // Will be validated later
        })
      }
    }

    return installations
  }

  /**
   * Check if Claude Code can be run via npx globally
   */
  private async checkGlobalNpx(): Promise<ClaudeInstallation | null> {
    try {
      const command = os.platform() === 'win32' 
        ? 'npx --version' 
        : 'which npx'
      
      await execAsync(command)
      
      return {
        id: 'global-npx',
        name: 'NPX Global (@anthropic-ai/claude-code)',
        path: 'npx @anthropic-ai/claude-code',
        type: 'global',
        valid: false // Will be validated later
      }
    } catch {
      return null
    }
  }

  /**
   * Remove duplicate installations based on resolved paths
   */
  private removeDuplicateInstallations(installations: ClaudeInstallation[]): ClaudeInstallation[] {
    const seen = new Set<string>()
    const unique: ClaudeInstallation[] = []

    for (const installation of installations) {
      let resolvedPath: string
      try {
        resolvedPath = path.resolve(installation.path)
      } catch {
        resolvedPath = installation.path
      }

      if (!seen.has(resolvedPath)) {
        seen.add(resolvedPath)
        unique.push(installation)
      }
    }

    return unique
  }

  /**
   * Validate if a Claude installation is working
   */
  private async validateClaudeInstallation(claudePath: string): Promise<boolean> {
    try {
      // For npx commands, test if the package can be resolved
      if (claudePath.includes('npx')) {
        const { stdout } = await execAsync('npx @anthropic-ai/claude-code --version', { timeout: 10000 })
        return stdout.includes('claude-code') || stdout.includes('anthropic') || stdout.includes('version')
      }

      // For binary paths, check if file exists and is executable
      if (fs.existsSync(claudePath)) {
        const stats = fs.statSync(claudePath)
        if (stats.isFile()) {
          // Try to run --version command
          const { stdout } = await execAsync(`"${claudePath}" --version`, { timeout: 10000 })
          return stdout.includes('claude') || stdout.includes('anthropic') || stdout.includes('version')
        }
      }

      return false
    } catch (error) {
      console.warn(`[Claude Detection] Failed to validate ${claudePath}:`, error)
      return false
    }
  }

  /**
   * Get Claude version from installation
   */
  private async getClaudeVersion(claudePath: string): Promise<string | undefined> {
    try {
      const command = claudePath.includes('npx') 
        ? 'npx @anthropic-ai/claude-code --version'
        : `"${claudePath}" --version`
      
      const { stdout } = await execAsync(command, { timeout: 5000 })
      
      // Extract version from output
      const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/)
      return versionMatch ? versionMatch[1] : stdout.trim().split('\n')[0] || 'Unknown'
    } catch {
      return undefined
    }
  }

  /**
   * Select the best default installation
   */
  private selectDefaultInstallation(installations: ClaudeInstallation[]): string | undefined {
    // Filter to only valid installations
    const validInstallations = installations.filter(i => i.valid)
    
    if (validInstallations.length === 0) {
      return undefined
    }

    // Priority order: binary > local > global
    const priorityOrder = ['binary', 'local', 'global']
    
    for (const type of priorityOrder) {
      const installation = validInstallations.find(i => i.type === type)
      if (installation) {
        return installation.path
      }
    }

    // Return first valid installation if no priority match
    return validInstallations[0].path
  }

  /**
   * Clear cache to force re-detection
   */
  public clearCache(): void {
    this.cachedResult = null
    this.cacheExpiry = 0
  }

  /**
   * Test if a specific Claude installation works
   */
  public async testClaudeInstallation(claudePath: string): Promise<boolean> {
    return await this.validateClaudeInstallation(claudePath)
  }
}