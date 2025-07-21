import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    electronAPI: {
      sendLog: (logEntry: LogEntry) => void
    }
    api: {
      // Logger APIs
      log: (level: string, message: string, component?: string, error?: any, meta?: Record<string, any>) => Promise<void>
      getRecentLogs: (lines?: number) => Promise<any>
      getLogDirectory: () => Promise<string>

      // Terminal APIs
      sendTerminalInput: (data: string, sessionId?: string) => Promise<void>
      resizeTerminal: (cols: number, rows: number, sessionId?: string) => Promise<void>
      onTerminalData: (callback: (data: { sessionId: string; data: string } | string) => void) => () => void;
      onTerminalClosed: (callback: (eventData: { sessionId: string; error: boolean }) => void) => () => void;
      requestSessionData: (sessionId: string) => Promise<void>;
      onSessionCreated: (callback: (session: any) => void) => () => void;
      onSessionUpdated: (callback: (updateData: { oldId: string; newSession: any }) => void) => () => void;

      // Claude Detection APIs
      getClaudeDetectionResult: () => Promise<ClaudeDetectionResult>;
      redetectClaude: () => Promise<ClaudeDetectionResult>;
      isClaudeAvailable: () => Promise<boolean>;
      onClaudeDetectionResult: (callback: (result: ClaudeDetectionResult) => void) => () => void;
      
      // PTY APIs
      startPty: (options?: any, sessionId?: string) => Promise<void>
      stopPty: (sessionId?: string) => Promise<void>
      changeDirectory: (path: string, sessionId?: string) => Promise<void>
      setEnvironmentVariable: (key: string, value: string, sessionId?: string) => Promise<void>
      getEnvironmentVariable: (key: string, sessionId?: string) => Promise<string | undefined>
      getAllEnvironmentVariables: (sessionId?: string) => Promise<Record<string, string>>
      startClaudeCode: (workingDirectory?: string, sessionId?: string) => Promise<void>
      
      // Project APIs
      createProject: (workingDirectory: string) => Promise<{ id: string; name: string; path: string }>
      selectProjectDirectory: () => Promise<string | null>
      getProjectSessions: (projectPath: string) => Promise<any>
      getAllProjects: () => Promise<any>
      
      // Session APIs
      createSession: (projectPath: string, name?: string) => Promise<{ id: string; projectPath: string; name: string }>
      activateSession: (sessionId: string) => Promise<boolean>
      resumeSession: (sessionId: string, projectPath: string) => Promise<any>
      deleteSession: (sessionId: string) => Promise<any>
      
      // Settings APIs
      getSettings: () => Promise<any>
      updateSettings: (settings: any) => Promise<void>
      
      // Status APIs
      getCurrentStatus: () => Promise<any>
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
  installations?: ClaudeInstallation[]
  defaultPath?: string
  error?: string
  version?: string
  timestamp: number
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