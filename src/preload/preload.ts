import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { LogEntry } from './index'

// Logger API for renderer
const loggerAPI = {
  sendLog: (logEntry: LogEntry) => ipcRenderer.send('logger:send', logEntry)
}

// Custom APIs for renderer
const api = {
  // Terminal APIs
  sendTerminalInput: (data: string, sessionId?: string) => ipcRenderer.invoke('terminal:input', data, sessionId),
  resizeTerminal: (cols: number, rows: number, sessionId?: string) => ipcRenderer.invoke('terminal:resize', cols, rows, sessionId),
  onTerminalData: (callback: (data: { sessionId: string; data: string } | string) => void) => 
    ipcRenderer.on('terminal:data', (_event, data) => callback(data)),
  
  // PTY APIs
  startPty: (options?: any, sessionId?: string) => ipcRenderer.invoke('pty:start', options, sessionId),
  stopPty: (sessionId?: string) => ipcRenderer.invoke('pty:stop', sessionId),
  changeDirectory: (path: string, sessionId?: string) => ipcRenderer.invoke('pty:change-directory', path, sessionId),
  setEnvironmentVariable: (key: string, value: string, sessionId?: string) => ipcRenderer.invoke('pty:set-env', key, value, sessionId),
  getEnvironmentVariable: (key: string, sessionId?: string) => ipcRenderer.invoke('pty:get-env', key, sessionId),
  getAllEnvironmentVariables: (sessionId?: string) => ipcRenderer.invoke('pty:get-all-env', sessionId),
  startClaudeCode: (workingDirectory?: string, sessionId?: string) => ipcRenderer.invoke('pty:start-claude-code', workingDirectory, sessionId),
  
  // Project APIs
  getProjects: () => ipcRenderer.invoke('projects:get'),
  createProject: (name: string, path: string) => ipcRenderer.invoke('projects:create', name, path),
  deleteProject: (id: string) => ipcRenderer.invoke('projects:delete', id),
  selectProjectDirectory: () => ipcRenderer.invoke('projects:select-directory'),
  getProjectHistory: () => ipcRenderer.invoke('projects:get-history'),
  clearProjectHistory: () => ipcRenderer.invoke('projects:clear-history'),
  extractProjectName: (path: string) => ipcRenderer.invoke('projects:extract-name', path),
  
  // Session APIs
  getSessions: (projectId: string) => ipcRenderer.invoke('sessions:get', projectId),
  createSession: (projectId: string, name?: string) => ipcRenderer.invoke('sessions:create', projectId, name),
  activateSession: (sessionId: string) => ipcRenderer.invoke('sessions:activate', sessionId),
  deleteSession: (id: string) => ipcRenderer.invoke('sessions:delete', id),
  
  // Settings APIs
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),
  
  // Statistics APIs
  getStats: (scope: 'session' | 'project' | 'global', id?: string) => 
    ipcRenderer.invoke('stats:get', scope, id),
  
  // Proxy APIs
  setActiveModel: (modelId: string) => ipcRenderer.invoke('proxy:set-model', modelId),
  
  // Claude Detection APIs
  detectClaude: () => ipcRenderer.invoke('claude:detect'),
  testClaudeInstallation: (claudePath: string) => ipcRenderer.invoke('claude:test-installation', claudePath),
  clearClaudeCache: () => ipcRenderer.invoke('claude:clear-cache'),

  // Claude Code Integration APIs
  getClaudeProjects: () => ipcRenderer.invoke('claude-code:get-projects'),
  resumeClaudeSession: (sessionPath: string, workingDirectory: string) => 
    ipcRenderer.invoke('claude-code:resume-session', sessionPath, workingDirectory),
  createNewClaudeSession: (workingDirectory: string) => 
    ipcRenderer.invoke('claude-code:create-new-session', workingDirectory)
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
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = loggerAPI
  // @ts-ignore (define in dts)
  window.api = api
}