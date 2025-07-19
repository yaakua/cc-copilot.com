import { create } from 'zustand'
import { Project, Session, ApiProvider, TokenUsage, Settings, ClaudeProject, ClaudeSession, ClaudeDetectionResult } from '../../../preload/index.d'

interface AppState {
  // UI State
  isSettingsOpen: boolean
  
  // Data
  settings: Settings
  
  // Claude Code Integration
  claudeProjects: ClaudeProject[]
  activeClaudeProjectId: string | null
  activeClaudeSessionId: string | null
  
  // Statistics
  currentStats: TokenUsage
  statsScope: 'session' | 'project' | 'global'
  
  // Terminal state
  isClaudeCodeRunning: boolean
  terminalConnected: boolean
  
  // Claude Detection
  claudeDetection: ClaudeDetectionResult | null
}

interface AppActions {
  // UI Actions
  setSettingsOpen: (open: boolean) => void
  setStatsScope: (scope: 'session' | 'project' | 'global') => void
  
  // Data Actions
  loadSettings: () => Promise<void>
  updateSettings: (settings: Partial<Settings>) => Promise<void>
  
  // Project Actions (for creating new projects)
  selectProjectDirectory: () => Promise<string | null>
  extractProjectName: (path: string) => Promise<string>
  
  // Claude Code Actions
  loadClaudeProjects: () => Promise<void>
  setActiveClaudeProject: (projectId: string | null) => void
  setActiveClaudeSession: (sessionId: string | null) => void
  resumeClaudeSession: (session: ClaudeSession, project: ClaudeProject) => Promise<void>
  createNewProject: (path: string) => Promise<void>
  createNewSession: (projectPath: string) => Promise<void>
  
  // Statistics Actions
  loadStats: () => Promise<void>
  
  // Terminal Actions
  setClaudeCodeRunning: (running: boolean) => void
  setTerminalConnected: (connected: boolean) => void
  startClaudeCode: (workingDirectory?: string) => Promise<void>
  stopClaudeCode: () => Promise<void>
  setActiveModel: (modelId: string) => Promise<void>
  
  // Claude Detection Actions
  detectClaude: () => Promise<void>
}

type AppStore = AppState & AppActions

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial State
  isSettingsOpen: false,
  settings: {
    apiProviders: [],
    theme: 'dark'
  },
  // Claude Code Integration
  claudeProjects: [],
  activeClaudeProjectId: null,
  activeClaudeSessionId: null,
  currentStats: { prompt: 0, completion: 0, total: 0 },
  statsScope: 'session',
  isClaudeCodeRunning: false,
  terminalConnected: false,
  claudeDetection: null,

  // UI Actions
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  setStatsScope: (scope) => {
    set({ statsScope: scope })
    get().loadStats()
  },

  // Data Actions
  loadSettings: async () => {
    try {
      const settings = await window.api.getSettings()
      set({ settings })
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  },

  updateSettings: async (newSettings: Partial<Settings>) => {
    try {
      await window.api.updateSettings(newSettings)
      const settings = { ...get().settings, ...newSettings }
      set({ settings })
    } catch (error) {
      console.error('Failed to update settings:', error)
      throw error
    }
  },

  // Project Actions
  selectProjectDirectory: async () => {
    try {
      return await window.api.selectProjectDirectory()
    } catch (error) {
      console.error('Failed to select project directory:', error)
      throw error
    }
  },

  extractProjectName: async (path: string) => {
    try {
      return await window.api.extractProjectName(path)
    } catch (error) {
      console.error('Failed to extract project name:', error)
      throw error
    }
  },

  // Statistics Actions
  loadStats: async () => {
    try {
      const { statsScope, activeClaudeSessionId, activeClaudeProjectId } = get()
      let id: string | undefined
      
      if (statsScope === 'session' && activeClaudeSessionId) {
        id = activeClaudeSessionId
      } else if (statsScope === 'project' && activeClaudeProjectId) {
        id = activeClaudeProjectId
      }
      
      const stats = await window.api.getStats(statsScope, id)
      set({ currentStats: stats })
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  },

  // Terminal Actions
  setClaudeCodeRunning: (running) => set({ isClaudeCodeRunning: running }),
  setTerminalConnected: (connected) => set({ terminalConnected: connected }),

  startClaudeCode: async (workingDirectory?: string) => {
    try {
      // Don't pass workingDirectory since PTY already starts in correct location
      await window.api.startClaudeCode()
      set({ isClaudeCodeRunning: true })
    } catch (error) {
      console.error('Failed to start claude-code:', error)
      throw error
    }
  },

  stopClaudeCode: async () => {
    try {
      await window.api.stopClaudeCode()
      set({ isClaudeCodeRunning: false })
    } catch (error) {
      console.error('Failed to stop claude-code:', error)
      throw error
    }
  },

  setActiveModel: async (modelId: string) => {
    try {
      await window.api.setActiveModel(modelId)
      await get().loadSettings() // Reload settings to get updated activeModelId
    } catch (error) {
      console.error('Failed to set active model:', error)
      throw error
    }
  },

  // Claude Code Actions
  loadClaudeProjects: async () => {
    try {
      const claudeProjects = await window.api.getClaudeProjects()
      set({ claudeProjects })
      
      // Set active Claude project if none selected
      if (!get().activeClaudeProjectId && claudeProjects.length > 0) {
        get().setActiveClaudeProject(claudeProjects[0].id)
      }
    } catch (error) {
      console.error('Failed to load Claude projects:', error)
    }
  },

  setActiveClaudeProject: (projectId) => {
    set({ 
      activeClaudeProjectId: projectId, 
      activeClaudeSessionId: null 
    })
  },

  setActiveClaudeSession: (sessionId) => {
    set({ activeClaudeSessionId: sessionId })
  },

  resumeClaudeSession: async (session: ClaudeSession, project: ClaudeProject) => {
    try {
      // Set active Claude session
      get().setActiveClaudeSession(session.id)
      
      // Resume the session using the API
      await window.api.resumeClaudeSession(session.filePath, project.path)
      
      console.log(`Resumed Claude session: ${session.name} in project: ${project.name}`)
    } catch (error) {
      console.error('Failed to resume Claude session:', error)
      throw error
    }
  },

  createNewProject: async (path: string) => {
    try {
      // 启动claude code在指定目录，这将自动创建新的项目
      await get().startClaudeCode(path)
      
      // 稍微延迟后刷新项目列表
      setTimeout(() => {
        get().loadClaudeProjects()
      }, 2000)
      
      console.log(`Created new Claude Code project in: ${path}`)
    } catch (error) {
      console.error('Failed to create new project:', error)
      throw error
    }
  },

  createNewSession: async (projectPath: string) => {
    try {
      // 使用新的API创建新的Claude Code会话
      const sessionId = await window.api.createNewClaudeSession(projectPath)
      
      // 立即设置活跃会话
      get().setActiveClaudeSession(sessionId)
      
      // 稍微延迟后刷新项目列表
      setTimeout(() => {
        get().loadClaudeProjects()
      }, 2000)
      
      console.log(`Created new Claude Code session ${sessionId} in: ${projectPath}`)
      return sessionId
    } catch (error) {
      console.error('Failed to create new session:', error)
      throw error
    }
  },

  // Claude Detection Actions
  detectClaude: async () => {
    try {
      const detection = await window.api.detectClaude()
      set({ claudeDetection: detection })
    } catch (error) {
      console.error('Failed to detect Claude:', error)
      set({ claudeDetection: { isInstalled: false, installations: [], error: 'Detection failed' } })
    }
  }
}))

// Initialize store data on app start
export const initializeStore = async () => {
  const store = useAppStore.getState()
  await store.loadSettings()
  await store.loadClaudeProjects()
  await store.loadStats()
  await store.detectClaude()
}