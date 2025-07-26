import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { LogEntry } from './index.d.ts'

// Logger API for renderer
const loggerAPI = {
  sendLog: (logEntry: LogEntry) => ipcRenderer.send('logger:send', logEntry)
}

// Custom APIs for renderer
const api = {
  // Logger APIs
  log: (level: string, message: string, component?: string, error?: any, meta?: Record<string, any>) => 
    ipcRenderer.invoke('logger:log', { level, message, component, error, meta }),
  getRecentLogs: (lines?: number) => ipcRenderer.invoke('logger:get-recent', lines),
  getLogDirectory: () => ipcRenderer.invoke('logger:get-log-dir'),

  // Terminal APIs
  sendTerminalInput: (data: string, sessionId?: string) => ipcRenderer.invoke('terminal:input', data, sessionId),
  resizeTerminal: (cols: number, rows: number, sessionId?: string) => ipcRenderer.invoke('terminal:resize', cols, rows, sessionId),
  sendSystemMessage: (message: string, sessionId?: string) => ipcRenderer.invoke('terminal:send-system-message', message, sessionId),
  onTerminalData: (callback: (data: { sessionId: string; data: string } | string) => void) => {
    console.log('在预加载中注册终端数据监听器')
    const listener = (_event: any, data: any) => {
      console.log('预加载接收到终端数据:', data)
      console.log('预加载正在调用回调函数处理数据')
      try {
        callback(data)
        console.log('预加载回调函数执行成功')
      } catch (error) {
        console.error('预加载回调执行失败:', error)
      }
    }
    ipcRenderer.on('terminal:data', listener)
    console.log('预加载终端数据监听器已注册')
    return () => {
      console.log('预加载正在移除终端数据监听器')
      ipcRenderer.removeListener('terminal:data', listener)
    }
  },
  onTerminalClosed: (callback: (eventData: { sessionId: string; error: boolean }) => void) => {
    const channel = 'terminal:closed'
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  
  onSessionCreated: (callback: (session: import('../shared/types').Session) => void) => {
    const listener = (_event: any, updateData: any) => callback(updateData)
    ipcRenderer.on('session:created', listener)
    return () => {
      ipcRenderer.removeListener('session:created', listener)
    }
  },
  
  onSessionUpdated: (callback: (updateData: { oldId: string; newSession: import('../shared/types').Session }) => void) => {
     const listener = (_event: any, updateData: any) => callback(updateData)
    ipcRenderer.on('session:updated', listener)
    return () => {
      ipcRenderer.removeListener('session:updated', listener)
    }
  },

  onSessionDeleted: (callback: (sessionId: string) => void) => {
    const listener = (_event: any, sessionId: string) => callback(sessionId)
    ipcRenderer.on('session:deleted', listener)
    return () => {
      ipcRenderer.removeListener('session:deleted', listener)
    }
  },

  onProjectCreated: (callback: (project: import('../shared/types').Project) => void) => {
    const listener = (_event: any, project: any) => callback(project)
    ipcRenderer.on('project:created', listener)
    return () => {
      ipcRenderer.removeListener('project:created', listener)
    }
  },
  onProjectsUpdated: (callback: (projects: import('../shared/types').Project[]) => void) => {
    const listener = (_event: any, projects: any) => callback(projects)
    ipcRenderer.on('projects:updated', listener)
    return () => {
      ipcRenderer.removeListener('projects:updated', listener)
    }
  },
  
  // Session APIs
  createSession: (projectId: string) => ipcRenderer.invoke('session:create', projectId),
  activateSession: (sessionId: string) => ipcRenderer.invoke('session:activate', sessionId),
  resumeSession: (sessionId: string, projectPath: string) => ipcRenderer.invoke('session:resume', sessionId, projectPath),
  deleteSession: (sessionId: string) => ipcRenderer.invoke('session:delete', sessionId),
  
  // Project APIs
  createProject: (workingDirectory: string) => ipcRenderer.invoke('project:create', workingDirectory),
  selectProjectDirectory: () => ipcRenderer.invoke('project:select-directory'),
  getProjectSessions: (projectPath: string) => ipcRenderer.invoke('project:get-sessions', projectPath),
  getAllProjects: () => ipcRenderer.invoke('project:get-all'),
  
  // Settings APIs
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),
  getProjectFilterConfig: () => ipcRenderer.invoke('settings:get-project-filter'),
  updateProjectFilterConfig: (config: any) => ipcRenderer.invoke('settings:update-project-filter', config),

  // Account Management APIs
  getServiceProviders: () => ipcRenderer.invoke('accounts:get-service-providers'),
  getActiveProvider: () => ipcRenderer.invoke('accounts:get-active-provider'),
  setActiveProvider: (providerId: string) => ipcRenderer.invoke('accounts:set-active-provider', providerId),
  setActiveAccount: (providerId: string, accountId: string) => ipcRenderer.invoke('accounts:set-active-account', providerId, accountId),
  refreshClaudeAccounts: () => ipcRenderer.invoke('accounts:refresh-claude-accounts'),
  addThirdPartyAccount: (providerId: string, account: any) => ipcRenderer.invoke('accounts:add-third-party', providerId, account),
  removeThirdPartyAccount: (providerId: string, accountId: string) => ipcRenderer.invoke('accounts:remove-third-party', providerId, accountId),
  setProviderProxy: (providerId: string, useProxy: boolean) => ipcRenderer.invoke('accounts:set-provider-proxy', providerId, useProxy),
  detectClaudeAuthorization: (accountEmail: string) => ipcRenderer.invoke('accounts:detect-claude-authorization', accountEmail),
  
  // Status APIs
  getCurrentStatus: () => ipcRenderer.invoke('status:get-current'),

  // Claude Detection APIs
  getClaudeDetectionResult: () => ipcRenderer.invoke('claude:get-detection-result'),
  redetectClaude: () => ipcRenderer.invoke('claude:redetect'),
  isClaudeAvailable: () => ipcRenderer.invoke('claude:is-available'),
  onClaudeDetectionResult: (callback: (result: any) => void) => {
    const listener = (_event: any, result: any) => {
      callback(result)
    }
    ipcRenderer.on('claude:detection-result', listener)
    return () => {
      ipcRenderer.removeListener('claude:detection-result', listener)
    }
  },

  // Settings event listeners
  onServiceProvidersUpdated: (callback: (providers: any[]) => void) => {
    const listener = (_event: any, providers: any) => callback(providers)
    ipcRenderer.on('service-providers:updated', listener)
    return () => ipcRenderer.removeListener('service-providers:updated', listener)
  },
  
  onActiveServiceProviderChanged: (callback: (providerId: string) => void) => {
    const listener = (_event: any, providerId: string) => callback(providerId)
    ipcRenderer.on('active-service-provider:changed', listener)
    return () => ipcRenderer.removeListener('active-service-provider:changed', listener)
  },
  
  onActiveAccountChanged: (callback: (data: { providerId: string, accountId: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('active-account:changed', listener)
    return () => ipcRenderer.removeListener('active-account:changed', listener)
  },
  
  onSettingsUpdated: (callback: (settings: any) => void) => {
    const listener = (_event: any, settings: any) => callback(settings)
    ipcRenderer.on('settings:updated', listener)
    return () => ipcRenderer.removeListener('settings:updated', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', loggerAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    // Use original console for preload errors since logger might not be available
    console.error('预加载上下文桥接错误:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = loggerAPI
  // @ts-ignore (define in dts)
  window.api = api
}