import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { LogEntry } from './index'

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
  onTerminalData: (callback: (data: { sessionId: string; data: string } | string) => void) => {
    console.log('Registering terminal data listener in preload')
    const listener = (_event: any, data: any) => {
      console.log('Preload received terminal data:', data)
      callback(data)
    }
    ipcRenderer.on('terminal:data', listener)
    return () => ipcRenderer.removeListener('terminal:data', listener)
  },
  
  // Session APIs
  createSession: (projectPath: string, name?: string) => ipcRenderer.invoke('session:create', projectPath, name),
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
  
  // Status APIs
  getCurrentStatus: () => ipcRenderer.invoke('status:get-current')
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
    console.error('Preload context bridge error:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = loggerAPI
  // @ts-ignore (define in dts)
  window.api = api
}