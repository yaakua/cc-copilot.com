import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Terminal APIs
  sendTerminalInput: (data: string) => ipcRenderer.invoke('terminal:input', data),
  onTerminalOutput: (callback: (data: string) => void) => 
    ipcRenderer.on('terminal:output', (_event, data) => callback(data)),
  
  // Claude Code APIs
  startClaudeCode: () => ipcRenderer.invoke('claude-code:start'),
  stopClaudeCode: () => ipcRenderer.invoke('claude-code:stop'),
  
  // Project APIs
  getProjects: () => ipcRenderer.invoke('projects:get'),
  createProject: (name: string) => ipcRenderer.invoke('projects:create', name),
  deleteProject: (id: string) => ipcRenderer.invoke('projects:delete', id),
  
  // Session APIs
  getSessions: (projectId: string) => ipcRenderer.invoke('sessions:get', projectId),
  createSession: (projectId: string, name: string) => ipcRenderer.invoke('sessions:create', projectId, name),
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