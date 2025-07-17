import { create } from 'zustand'
import { Project, Session, ApiProvider, TokenUsage, Settings } from '../../../preload/index.d'

interface AppState {
  // UI State
  activeProjectId: string | null
  activeSessionId: string | null
  isSettingsOpen: boolean
  
  // Data
  projects: Project[]
  sessions: Session[]
  settings: Settings
  
  // Statistics
  currentStats: TokenUsage
  statsScope: 'session' | 'project' | 'global'
  
  // Terminal state
  isClaudeCodeRunning: boolean
  terminalConnected: boolean
}

interface AppActions {
  // UI Actions
  setActiveProject: (projectId: string | null) => void
  setActiveSession: (sessionId: string | null) => void
  setSettingsOpen: (open: boolean) => void
  setStatsScope: (scope: 'session' | 'project' | 'global') => void
  
  // Data Actions
  loadProjects: () => Promise<void>
  loadSessions: (projectId: string) => Promise<void>
  loadSettings: () => Promise<void>
  createProject: (name: string) => Promise<Project>
  createSession: (projectId: string, name: string) => Promise<Session>
  deleteProject: (id: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  updateSettings: (settings: Partial<Settings>) => Promise<void>
  
  // Statistics Actions
  loadStats: () => Promise<void>
  
  // Terminal Actions
  setClaudeCodeRunning: (running: boolean) => void
  setTerminalConnected: (connected: boolean) => void
  startClaudeCode: () => Promise<void>
  stopClaudeCode: () => Promise<void>
  setActiveModel: (modelId: string) => Promise<void>
}

type AppStore = AppState & AppActions

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial State
  activeProjectId: null,
  activeSessionId: null,
  isSettingsOpen: false,
  projects: [],
  sessions: [],
  settings: {
    apiProviders: [],
    theme: 'dark'
  },
  currentStats: { prompt: 0, completion: 0, total: 0 },
  statsScope: 'session',
  isClaudeCodeRunning: false,
  terminalConnected: false,

  // UI Actions
  setActiveProject: (projectId) => {
    set({ activeProjectId: projectId, activeSessionId: null })
    if (projectId) {
      get().loadSessions(projectId)
    }
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId })
    get().loadStats()
  },

  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  setStatsScope: (scope) => {
    set({ statsScope: scope })
    get().loadStats()
  },

  // Data Actions
  loadProjects: async () => {
    try {
      const projects = await window.api.getProjects()
      set({ projects })
      
      // Set active project if none selected
      if (!get().activeProjectId && projects.length > 0) {
        get().setActiveProject(projects[0].id)
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  },

  loadSessions: async (projectId: string) => {
    try {
      const sessions = await window.api.getSessions(projectId)
      set({ sessions })
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  },

  loadSettings: async () => {
    try {
      const settings = await window.api.getSettings()
      set({ settings })
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  },

  createProject: async (name: string) => {
    try {
      const project = await window.api.createProject(name)
      const projects = [...get().projects, project]
      set({ projects })
      get().setActiveProject(project.id)
      return project
    } catch (error) {
      console.error('Failed to create project:', error)
      throw error
    }
  },

  createSession: async (projectId: string, name: string) => {
    try {
      const session = await window.api.createSession(projectId, name)
      await get().loadSessions(projectId)
      get().setActiveSession(session.id)
      return session
    } catch (error) {
      console.error('Failed to create session:', error)
      throw error
    }
  },

  deleteProject: async (id: string) => {
    try {
      await window.api.deleteProject(id)
      const projects = get().projects.filter(p => p.id !== id)
      set({ projects })
      
      // Clear active project if it was deleted
      if (get().activeProjectId === id) {
        const newActiveProject = projects.length > 0 ? projects[0].id : null
        get().setActiveProject(newActiveProject)
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
      throw error
    }
  },

  deleteSession: async (id: string) => {
    try {
      await window.api.deleteSession(id)
      const sessions = get().sessions.filter(s => s.id !== id)
      set({ sessions })
      
      // Clear active session if it was deleted
      if (get().activeSessionId === id) {
        const newActiveSession = sessions.length > 0 ? sessions[0].id : null
        get().setActiveSession(newActiveSession)
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
      throw error
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

  // Statistics Actions
  loadStats: async () => {
    try {
      const { statsScope, activeSessionId, activeProjectId } = get()
      let id: string | undefined
      
      if (statsScope === 'session' && activeSessionId) {
        id = activeSessionId
      } else if (statsScope === 'project' && activeProjectId) {
        id = activeProjectId
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

  startClaudeCode: async () => {
    try {
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
  }
}))

// Initialize store data on app start
export const initializeStore = async () => {
  const store = useAppStore.getState()
  await store.loadSettings()
  await store.loadProjects()
  await store.loadStats()
}