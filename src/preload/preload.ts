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
  requestSessionData: (sessionId: string) => ipcRenderer.invoke('terminal:request-data', sessionId),
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