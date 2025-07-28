import { ElectronAPI } from '@electron-toolkit/preload'
import { Project, Session, ClaudeDetectionResult } from '../shared/types'

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
      sendSystemMessage: (message: string, sessionId?: string) => Promise<void>
      onTerminalData: (callback: (data: { sessionId: string; data: string } | string) => void) => () => void;
      onTerminalClosed: (callback: (eventData: { sessionId: string; error: boolean }) => void) => () => void;
      requestSessionData: (sessionId: string) => Promise<void>;
      onSessionCreated: (callback: (session: Session) => void) => () => void;
      onSessionUpdated: (callback: (updateData: { oldId: string; newSession: Session }) => void) => () => void;
      onSessionDeleted: (callback: (sessionId: string) => void) => () => void;
      onSessionAuthRequired: (callback: (authData: { error: string; loginInstructions: string }) => void) => () => void;
      onProjectCreated: (callback: (project: Project) => void) => () => void;
      onProjectsUpdated: (callback: (projects: Project[]) => void) => () => void;

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
      createProject: (workingDirectory: string) => Promise<{ project: Project, session: Session }>
      selectProjectDirectory: () => Promise<string | null>
      getProjectSessions: (projectPath: string) => Promise<any>
      getAllProjects: () => Promise<Project[]>
      getClaudeProjectDirectory: (projectPath: string) => Promise<string | null>
      deleteProject: (projectId: string) => Promise<{ success: boolean; error?: string }>
      refreshProjectSessions: (projectId: string) => Promise<{ success: boolean; error?: string }>
      
      // Session APIs
      createSession: (projectId: string) => Promise<Session | { error: string; loginInstructions: string }>
      activateSession: (sessionId: string) => Promise<boolean>
      resumeSession: (sessionId: string, projectPath: string) => Promise<any>
      deleteSession: (sessionId: string) => Promise<any>
      
      // Settings APIs
      getSettings: () => Promise<any>
      updateSettings: (settings: any) => Promise<void>
      getProjectFilterConfig: () => Promise<any>
      updateProjectFilterConfig: (config: any) => Promise<void>

      // Account Management APIs
      getServiceProviders: () => Promise<any[]>
      getActiveProvider: () => Promise<any | null>
      setActiveProvider: (providerId: string) => Promise<void>
      setActiveAccount: (providerId: string, accountId: string) => Promise<void>
      refreshClaudeAccounts: () => Promise<any[]>
      addThirdPartyAccount: (providerId: string, account: any) => Promise<void>
      removeThirdPartyAccount: (providerId: string, accountId: string) => Promise<void>
      setProviderProxy: (providerId: string, useProxy: boolean) => Promise<void>
      detectClaudeAuthorization: (accountEmail: string) => Promise<{ success: boolean, error?: string }>
      
      // Status APIs
      getCurrentStatus: () => Promise<any>

      // Settings event listeners
      onServiceProvidersUpdated: (callback: (providers: any[]) => void) => () => void
      onActiveServiceProviderChanged: (callback: (providerId: string) => void) => () => void
      onActiveAccountChanged: (callback: (data: { providerId: string, accountId: string }) => void) => () => void
      onSettingsUpdated: (callback: (settings: any) => void) => () => void
    }
  }
}