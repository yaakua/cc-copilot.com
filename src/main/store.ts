import Store from 'electron-store'

export interface Project {
  id: string
  name: string
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
}

export interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

export interface AppSettings {
  apiProviders: ApiProvider[]
  proxy?: string
  activeModelId?: string
  theme?: 'dark' | 'light'
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
          models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
        }
      ],
      activeModelId: 'anthropic',
      theme: 'dark'
    }
  },
  stats: {
    type: 'object',
    default: {
      global: { prompt: 0, completion: 0, total: 0 },
      projects: {},
      sessions: {}
    }
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

  createProject(name: string): Project {
    const project: Project = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toISOString()
    }
    
    const projects = this.getProjects()
    projects.push(project)
    this.store.set('projects', projects)
    
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

  createSession(projectId: string, name: string): Session {
    const session: Session = {
      id: Date.now().toString(),
      projectId,
      name,
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
    this.store.set('settings', { ...currentSettings, ...settings })
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
}