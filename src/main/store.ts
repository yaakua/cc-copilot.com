import Store from 'electron-store'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface Project {
  id: string
  name: string
  path: string
  createdAt: string
}

export interface Session {
  id: string
  projectId: string
  name: string
  createdAt: string
  history: Message[]
  tokenUsage: TokenUsage
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ApiProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  adapter: string
  models?: string[]
  isOfficial?: boolean
  authType?: 'api_key' | 'oauth' | 'session'
}

export interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

export interface UserAuth {
  id: string
  provider: string
  username?: string
  email?: string
  accessToken?: string
  refreshToken?: string
  sessionCookie?: string
  expiresAt?: string
  lastLoginAt?: string
  isActive: boolean
}

export interface ChannelStatus {
  currentProviderId: string
  currentProviderName: string
  isOfficial: boolean
  connectionStatus: 'connected' | 'disconnected' | 'error'
  lastSwitchAt?: string
}

// Claude Code interfaces
export interface ClaudeProject {
  id: string
  name: string
  path: string
  sessionsDir: string
  sessions: ClaudeSession[]
}

export interface ClaudeSession {
  id: string
  name: string
  filePath: string
  createdAt: string
  firstMessage?: string
}

export interface ProxyConfig {
  enabled: boolean
  host: string
  port: number
  username?: string
  password?: string
  protocol: 'http' | 'https'
}

export interface AppSettings {
  apiProviders: ApiProvider[]
  proxy?: string
  proxyConfig?: ProxyConfig
  activeModelId?: string
  theme?: 'dark' | 'light'
  autoLogin?: boolean
  channelStatus?: ChannelStatus
}

export interface AppData {
  projects: Project[]
  sessions: Session[]
  settings: AppSettings
  stats: {
    global: TokenUsage
    projects: { [projectId: string]: TokenUsage }
    sessions: { [sessionId: string]: TokenUsage }
  }
  projectHistory: string[]
  userAuth: UserAuth[]
}

const schema = {
  projects: {
    type: 'array',
    default: []
  },
  sessions: {
    type: 'array', 
    default: []
  },
  settings: {
    type: 'object',
    default: {
      apiProviders: [
        {
          id: 'anthropic',
          name: 'Anthropic Claude',
          baseUrl: 'https://api.anthropic.com',
          apiKey: '',
          adapter: 'anthropic',
          models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
          isOfficial: true,
          authType: 'api_key'
        }
      ],
      activeModelId: 'anthropic',
      theme: 'dark',
      autoLogin: true,
      proxyConfig: {
        enabled: false,
        host: '',
        port: 8080,
        protocol: 'http'
      },
      channelStatus: {
        currentProviderId: 'anthropic',
        currentProviderName: 'Anthropic Claude',
        isOfficial: true,
        connectionStatus: 'disconnected'
      }
    }
  },
  stats: {
    type: 'object',
    default: {
      global: { prompt: 0, completion: 0, total: 0 },
      projects: {},
      sessions: {}
    }
  },
  projectHistory: {
    type: 'array',
    default: []
  },
  userAuth: {
    type: 'array',
    default: []
  }
}

export class DataStore {
  private store: Store<AppData>

  constructor() {
    this.store = new Store({
      schema,
      name: 'cc-copilot-data'
    })
  }

  // Projects
  getProjects(): Project[] {
    return this.store.get('projects', [])
  }

  createProject(name: string, path: string): Project {
    const project: Project = {
      id: Date.now().toString(),
      name,
      path,
      createdAt: new Date().toISOString()
    }
    
    const projects = this.getProjects()
    projects.push(project)
    this.store.set('projects', projects)
    
    // Add to project history
    this.addToProjectHistory(path)
    
    return project
  }

  deleteProject(id: string): void {
    const projects = this.getProjects().filter(p => p.id !== id)
    const sessions = this.getSessions().filter(s => s.projectId !== id)
    
    this.store.set('projects', projects)
    this.store.set('sessions', sessions)
  }

  // Sessions
  getSessions(projectId?: string): Session[] {
    const sessions = this.store.get('sessions', [])
    return projectId ? sessions.filter(s => s.projectId === projectId) : sessions
  }

  createSession(projectId: string, name?: string): Session {
    // 生成默认会话名称
    const projectSessions = this.getSessions(projectId)
    const sessionNumber = projectSessions.length + 1
    const defaultName = name || `新会话 ${sessionNumber}`
    
    const session: Session = {
      id: Date.now().toString(),
      projectId,
      name: defaultName,
      createdAt: new Date().toISOString(),
      history: [],
      tokenUsage: { prompt: 0, completion: 0, total: 0 }
    }
    
    const sessions = this.getSessions()
    sessions.push(session)
    this.store.set('sessions', sessions)
    
    return session
  }

  deleteSession(id: string): void {
    const sessions = this.getSessions().filter(s => s.id !== id)
    this.store.set('sessions', sessions)
  }

  // Settings
  getSettings(): AppSettings {
    return this.store.get('settings')
  }

  updateSettings(settings: Partial<AppSettings>): void {
    const currentSettings = this.getSettings()
    const newSettings = { ...currentSettings, ...settings }
    
    console.log('[DataStore] Updating settings:', {
      oldProxyConfig: currentSettings.proxyConfig,
      newProxyConfig: newSettings.proxyConfig,
      proxyConfigChanged: JSON.stringify(currentSettings.proxyConfig) !== JSON.stringify(newSettings.proxyConfig)
    })
    
    this.store.set('settings', newSettings)
    console.log('[DataStore] Settings updated successfully')
  }

  // Statistics
  getStats(scope: 'global' | 'project' | 'session', id?: string): TokenUsage {
    const stats = this.store.get('stats')
    
    switch (scope) {
      case 'global':
        return stats.global
      case 'project':
        return id ? stats.projects[id] || { prompt: 0, completion: 0, total: 0 } : stats.global
      case 'session':
        return id ? stats.sessions[id] || { prompt: 0, completion: 0, total: 0 } : stats.global
      default:
        return stats.global
    }
  }

  updateStats(scope: 'global' | 'project' | 'session', usage: TokenUsage, id?: string): void {
    const stats = this.store.get('stats')
    
    // Update global stats
    stats.global.prompt += usage.prompt
    stats.global.completion += usage.completion
    stats.global.total += usage.total
    
    // Update specific scope stats
    if (scope === 'project' && id) {
      if (!stats.projects[id]) {
        stats.projects[id] = { prompt: 0, completion: 0, total: 0 }
      }
      stats.projects[id].prompt += usage.prompt
      stats.projects[id].completion += usage.completion
      stats.projects[id].total += usage.total
    } else if (scope === 'session' && id) {
      if (!stats.sessions[id]) {
        stats.sessions[id] = { prompt: 0, completion: 0, total: 0 }
      }
      stats.sessions[id].prompt += usage.prompt
      stats.sessions[id].completion += usage.completion
      stats.sessions[id].total += usage.total
    }
    
    this.store.set('stats', stats)
  }

  // Project History
  getProjectHistory(): string[] {
    return this.store.get('projectHistory', [])
  }

  addToProjectHistory(path: string): void {
    const history = this.getProjectHistory()
    
    // Remove existing entry if it exists
    const filteredHistory = history.filter(p => p !== path)
    
    // Add to beginning of array
    filteredHistory.unshift(path)
    
    // Keep only last 10 entries
    const limitedHistory = filteredHistory.slice(0, 10)
    
    this.store.set('projectHistory', limitedHistory)
  }

  clearProjectHistory(): void {
    this.store.set('projectHistory', [])
  }

  // User Authentication
  getUserAuth(): UserAuth[] {
    return this.store.get('userAuth', [])
  }

  getActiveUserAuth(): UserAuth | null {
    const auths = this.getUserAuth()
    return auths.find(auth => auth.isActive) || null
  }

  saveUserAuth(auth: UserAuth): void {
    const auths = this.getUserAuth()
    
    // Deactivate other auths for the same provider
    auths.forEach(existingAuth => {
      if (existingAuth.provider === auth.provider) {
        existingAuth.isActive = false
      }
    })
    
    // Find existing auth or add new one
    const existingIndex = auths.findIndex(a => a.id === auth.id)
    if (existingIndex >= 0) {
      auths[existingIndex] = auth
    } else {
      auths.push(auth)
    }
    
    this.store.set('userAuth', auths)
  }

  removeUserAuth(id: string): void {
    const auths = this.getUserAuth().filter(auth => auth.id !== id)
    this.store.set('userAuth', auths)
  }

  // Channel Management
  updateChannelStatus(status: Partial<ChannelStatus>): void {
    const settings = this.getSettings()
    const currentStatus = settings.channelStatus || {
      currentProviderId: 'anthropic',
      currentProviderName: 'Anthropic Claude',
      isOfficial: true,
      connectionStatus: 'disconnected'
    }
    
    const newStatus = { ...currentStatus, ...status }
    if (status.currentProviderId) {
      newStatus.lastSwitchAt = new Date().toISOString()
    }
    
    this.updateSettings({
      channelStatus: newStatus
    })
  }

  getChannelStatus(): ChannelStatus {
    const settings = this.getSettings()
    return settings.channelStatus || {
      currentProviderId: 'anthropic',
      currentProviderName: 'Anthropic Claude',
      isOfficial: true,
      connectionStatus: 'disconnected'
    }
  }

  switchChannel(providerId: string): boolean {
    const settings = this.getSettings()
    const provider = settings.apiProviders.find(p => p.id === providerId)
    
    if (!provider) {
      return false
    }
    
    this.updateChannelStatus({
      currentProviderId: providerId,
      currentProviderName: provider.name,
      isOfficial: provider.isOfficial || false,
      connectionStatus: 'connected'
    })
    
    return true
  }

  // Auto Login
  getAutoLoginSetting(): boolean {
    const settings = this.getSettings()
    return settings.autoLogin || false
  }

  setAutoLogin(enabled: boolean): void {
    this.updateSettings({ autoLogin: enabled })
  }

  // Claude Official Auth Integration
  saveClaudeOfficialAuth(authData: {
    username?: string
    email?: string
    accessToken?: string
    sessionCookie?: string
    expiresAt?: string
  }): void {
    const auth: UserAuth = {
      id: `claude-official-${Date.now()}`,
      provider: 'anthropic',
      username: authData.username,
      email: authData.email,
      accessToken: authData.accessToken,
      sessionCookie: authData.sessionCookie,
      expiresAt: authData.expiresAt,
      lastLoginAt: new Date().toISOString(),
      isActive: true
    }
    
    this.saveUserAuth(auth)
  }

  getClaudeOfficialAuth(): UserAuth | null {
    const auths = this.getUserAuth()
    return auths.find(auth => auth.provider === 'anthropic' && auth.isActive) || null
  }

  isClaudeOfficialAuthValid(): boolean {
    const auth = this.getClaudeOfficialAuth()
    if (!auth) return false
    
    if (auth.expiresAt) {
      const expiryTime = new Date(auth.expiresAt)
      const now = new Date()
      return now < expiryTime
    }
    
    return true
  }

  // Claude Code Integration
  getClaudeProjects(): ClaudeProject[] {
    try {
      const claudeDir = path.join(os.homedir(), '.claude')
      const projectsDir = path.join(claudeDir, 'projects')
      
      if (!fs.existsSync(projectsDir)) {
        return []
      }
      
      const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
      
      const projects: ClaudeProject[] = []
      
      for (const projectDirName of projectDirs) {
        const projectDirPath = path.join(projectsDir, projectDirName)
        const sessions = this.getClaudeSessionsForProject(projectDirPath)
        
        // 从第一个会话文件中获取项目路径
        let projectPath = projectDirName
        if (sessions.length > 0) {
          const firstSessionPath = sessions[0].filePath
          const cwd = this.extractCwdFromSession(firstSessionPath)
          if (cwd) {
            projectPath = cwd
          }
        }
        
        const project: ClaudeProject = {
          id: projectDirName,
          name: path.basename(projectPath),
          path: projectPath,
          sessionsDir: projectDirPath,
          sessions
        }
        
        projects.push(project)
      }
      
      return projects
    } catch (error) {
      console.error('Error reading Claude projects:', error)
      return []
    }
  }

  private getClaudeSessionsForProject(projectDir: string): ClaudeSession[] {
    try {
      const sessionFiles = fs.readdirSync(projectDir)
        .filter(file => file.endsWith('.jsonl'))
        .sort((a, b) => {
          // 按文件修改时间排序，最新的在前
          const aPath = path.join(projectDir, a)
          const bPath = path.join(projectDir, b)
          const aStat = fs.statSync(aPath)
          const bStat = fs.statSync(bPath)
          return bStat.mtime.getTime() - aStat.mtime.getTime()
        })
      
      const sessions: ClaudeSession[] = []
      
      for (const sessionFile of sessionFiles) {
        const sessionPath = path.join(projectDir, sessionFile)
        const sessionId = path.basename(sessionFile, '.jsonl')
        const stats = fs.statSync(sessionPath)
        
        // 读取第一行来获取会话的第一条消息
        const firstMessage = this.getFirstMessageFromSession(sessionPath)
        const sessionName = this.generateSessionName(firstMessage, sessions.length + 1)
        
        sessions.push({
          id: sessionId,
          name: sessionName,
          filePath: sessionPath,
          createdAt: stats.birthtime.toISOString(),
          firstMessage
        })
      }
      
      return sessions
    } catch (error) {
      console.error('Error reading Claude sessions:', error)
      return []
    }
  }

  private extractCwdFromSession(sessionPath: string): string | null {
    try {
      const content = fs.readFileSync(sessionPath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line)
          // Claude Code 会话文件中的 cwd 在 user 或 assistant 类型的消息中
          if (event.cwd) {
            return event.cwd
          }
        } catch (e) {
          // 忽略解析错误的行
          continue
        }
      }
      
      return null
    } catch (error) {
      console.error('Error extracting cwd from session:', error)
      return null
    }
  }

  private getFirstMessageFromSession(sessionPath: string): string | undefined {
    try {
      const content = fs.readFileSync(sessionPath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line)
          // 查找用户类型的消息
          if (event.type === 'user' && event.message && event.message.content) {
            const content = event.message.content
            let text = ''
            
            // 处理 content 数组格式
            if (Array.isArray(content)) {
              const textContent = content.find(item => item.type === 'text')
              if (textContent && textContent.text) {
                text = textContent.text
              }
            } else if (typeof content === 'string') {
              text = content
            }
            
            if (text) {
              // 返回前50个字符作为预览，去掉换行符
              const preview = text.replace(/\n/g, ' ').trim()
              return preview.slice(0, 50) + (preview.length > 50 ? '...' : '')
            }
          }
        } catch (e) {
          // 忽略解析错误的行
          continue
        }
      }
      
      return undefined
    } catch (error) {
      console.error('Error reading first message from session:', error)
      return undefined
    }
  }

  private generateSessionName(firstMessage?: string, sessionNumber?: number): string {
    if (firstMessage && firstMessage.trim()) {
      // 使用第一条消息的前30个字符作为会话名称
      return firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '')
    }
    
    return `会话 ${sessionNumber || 1}`
  }

  resumeClaudeSession(sessionPath: string, workingDirectory: string): void {
    // 这个方法将由PTY管理器调用来恢复Claude会话
    // 它会执行类似 "claude /resume <session-file>" 的命令
    console.log(`Resuming Claude session: ${sessionPath} in ${workingDirectory}`)
  }
}