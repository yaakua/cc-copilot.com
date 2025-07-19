import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    electronAPI: {
      sendLog: (logEntry: LogEntry) => void
    }
    api: {
      // Terminal APIs
      sendTerminalInput: (data: string, sessionId?: string) => Promise<void>
      resizeTerminal: (cols: number, rows: number, sessionId?: string) => Promise<void>
      onTerminalData: (callback: (data: { sessionId: string; data: string } | string) => void) => void
      
      // PTY APIs
      startPty: (options?: any, sessionId?: string) => Promise<void>
      stopPty: (sessionId?: string) => Promise<void>
      changeDirectory: (path: string, sessionId?: string) => Promise<void>
      setEnvironmentVariable: (key: string, value: string, sessionId?: string) => Promise<void>
      getEnvironmentVariable: (key: string, sessionId?: string) => Promise<string | undefined>
      getAllEnvironmentVariables: (sessionId?: string) => Promise<Record<string, string>>
      startClaudeCode: (workingDirectory?: string, sessionId?: string) => Promise<void>
      
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
      
      // Claude Detection APIs
      detectClaude: () => Promise<ClaudeDetectionResult>
      testClaudeInstallation: (claudePath: string) => Promise<boolean>
      clearClaudeCache: () => Promise<void>

      // Claude Code Integration APIs
      getClaudeProjects: () => Promise<ClaudeProject[]>
      resumeClaudeSession: (sessionPath: string, workingDirectory: string) => Promise<void>
      createNewClaudeSession: (workingDirectory: string) => Promise<string>
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

export interface ProxyConfig {
  enabled: boolean
  host: string
  port: number
  username?: string
  password?: string
  protocol: 'http' | 'https'
}

export interface Settings {
  apiProviders: ApiProvider[]
  proxy?: string
  proxyConfig?: ProxyConfig
  activeModelId?: string
  defaultClaudePath?: string
}

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

export interface LogEntry {
  timestamp: string
  level: string
  message: string
  filename?: string
  line?: number
  error?: string
  meta?: any
}