import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // Terminal APIs
      sendTerminalInput: (data: string) => Promise<void>
      resizeTerminal: (cols: number, rows: number) => Promise<void>
      onTerminalData: (callback: (data: string) => void) => void
      
      // PTY APIs
      startPty: (options?: any) => Promise<void>
      stopPty: () => Promise<void>
      changeDirectory: (path: string) => Promise<void>
      setEnvironmentVariable: (key: string, value: string) => Promise<void>
      getEnvironmentVariable: (key: string) => Promise<string | undefined>
      getAllEnvironmentVariables: () => Promise<Record<string, string>>
      startClaudeCode: (workingDirectory?: string) => Promise<void>
      
      // Project APIs
      getProjects: () => Promise<Project[]>
      createProject: (name: string, path: string) => Promise<Project>
      deleteProject: (id: string) => Promise<void>
      selectProjectDirectory: () => Promise<string | null>
      getProjectHistory: () => Promise<string[]>
      clearProjectHistory: () => Promise<void>
      extractProjectName: (path: string) => Promise<string>
      
      // Session APIs
      getSessions: (projectId: string) => Promise<Session[]>
      createSession: (projectId: string, name?: string) => Promise<Session>
      activateSession: (sessionId: string) => Promise<void>
      deleteSession: (id: string) => Promise<void>
      
      // Settings APIs
      getSettings: () => Promise<Settings>
      updateSettings: (settings: any) => Promise<void>
      
      // Statistics APIs
      getStats: (scope: 'session' | 'project' | 'global', id?: string) => Promise<TokenUsage>
      
      // Proxy APIs
      setActiveModel: (modelId: string) => Promise<void>
    }
  }
}

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
}

export interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

export interface Settings {
  apiProviders: ApiProvider[]
  proxy?: string
  activeModelId?: string
}