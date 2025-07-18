import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Terminal APIs
  sendTerminalInput: (data: string) => ipcRenderer.invoke('terminal:input', data),
  resizeTerminal: (cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', cols, rows),
  onTerminalData: (callback: (data: string) => void) => 
    ipcRenderer.on('terminal:data', (_event, data) => callback(data)),
  
  // PTY APIs
  startPty: (options?: any) => ipcRenderer.invoke('pty:start', options),
  stopPty: () => ipcRenderer.invoke('pty:stop'),
  changeDirectory: (path: string) => ipcRenderer.invoke('pty:change-directory', path),
  setEnvironmentVariable: (key: string, value: string) => ipcRenderer.invoke('pty:set-env', key, value),
  getEnvironmentVariable: (key: string) => ipcRenderer.invoke('pty:get-env', key),
  getAllEnvironmentVariables: () => ipcRenderer.invoke('pty:get-all-env'),
  startClaudeCode: (workingDirectory?: string) => ipcRenderer.invoke('pty:start-claude-code', workingDirectory),
  
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
  setActiveModel: (modelId: string) => ipcRenderer.invoke('proxy:set-model', modelId)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}