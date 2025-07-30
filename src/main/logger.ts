import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  component?: string
  error?: Error
  meta?: Record<string, any>
  caller?: string
}

export class Logger {
  private static instance: Logger
  private logDir: string
  private currentLogFile: string
  private minLevel: LogLevel = LogLevel.INFO
  private maxFileSize: number = 10 * 1024 * 1024 // 10MB
  private maxFiles: number = 5

  private constructor() {
    // Create logs directory in user data folder
    this.logDir = path.join(app.getPath('userData'), 'logs')
    console.log('日志目录:', this.logDir)
    this.ensureLogDirectory()
    this.currentLogFile = this.getLogFileName()
    this.cleanOldLogs()
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true })
    }
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0]
    return path.join(this.logDir, `cc-copilot-${date}.log`)
  }

  private cleanOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith('cc-copilot-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          stats: fs.statSync(path.join(this.logDir, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime())

      // Keep only the latest files
      const filesToDelete = files.slice(this.maxFiles)
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path)
        } catch (error) {
          console.warn(`删除旧日志文件失败 ${file.name}:`, error)
        }
      })
    } catch (error) {
      console.warn('清理旧日志失败:', error)
    }
  }

  private rotateLogFile(): void {
    try {
      const stats = fs.statSync(this.currentLogFile)
      if (stats.size >= this.maxFileSize) {
        // Create new log file
        this.currentLogFile = this.getLogFileName()
        this.cleanOldLogs()
      }
    } catch (error) {
      // File doesn't exist yet, that's ok
    }
  }

  private writeToFile(entry: LogEntry): void {
    try {
      this.rotateLogFile()
      
      const logLine = JSON.stringify({
        timestamp: entry.timestamp,
        level: LogLevel[entry.level],
        component: entry.component || 'main',
        message: entry.message,
        caller: entry.caller,
        error: entry.error ? {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack
        } : undefined,
        meta: entry.meta
      }) + '\n'

      fs.appendFileSync(this.currentLogFile, logLine, 'utf8')
    } catch (error) {
      console.error('写入日志文件失败:', error)
    }
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString()
    const level = LogLevel[entry.level].padEnd(5)
    const component = entry.component ? `[${entry.component}]` : '[main]'
    const caller = entry.caller ? `(${entry.caller})` : ''
    
    let message = `${timestamp} ${level} ${component} ${caller} ${entry.message}`
    
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      message += ` ${JSON.stringify(entry.meta)}`
    }
    
    return message
  }

  private getCallerInfo(): string {
    const stack = new Error().stack
    if (!stack) return '未知'
    
    const lines = stack.split('\n')
    // Skip Error, getCallerInfo, log method, and the actual logger method call
    for (let i = 4; i < lines.length; i++) {
      const line = lines[i]
      if (line && !line.includes('node_modules') && !line.includes('logger.ts')) {
        // Extract file path and line number
        const match = line.match(/\s+at\s+.*\s+\((.+):(\d+):(\d+)\)/) || line.match(/\s+at\s+(.+):(\d+):(\d+)/)
        if (match) {
          const filePath = match[1]
          const lineNumber = match[2]
          const fileName = filePath.split('/').pop() || filePath
          return `${fileName}:${lineNumber}`
        }
      }
    }
    return '未知'
  }

  private log(level: LogLevel, message: string, component?: string, error?: Error, meta?: Record<string, any>): void {
    if (level < this.minLevel) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component,
      error,
      meta,
      caller: this.getCallerInfo()
    }

    // Write to file
    this.writeToFile(entry)

    // Also output to console in development
    const consoleMessage = this.formatConsoleMessage(entry)
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(consoleMessage)
        break
      case LogLevel.INFO:
        console.info(consoleMessage)
        break
      case LogLevel.WARN:
        console.warn(consoleMessage)
        if (error) console.warn(error)
        break
      case LogLevel.ERROR:
        console.error(consoleMessage)
        if (error) console.error(error)
        break
    }
  }

  public debug(message: string, component?: string, meta?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, component, undefined, meta)
  }

  public info(message: string, component?: string, meta?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, component, undefined, meta)
  }

  public warn(message: string, component?: string, error?: Error, meta?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, component, error, meta)
  }

  public error(message: string, component?: string, error?: Error, meta?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, component, error, meta)
  }

  // Method for handling logs from renderer process
  public logFromRenderer(logEntry: {
    level: string
    message: string
    component?: string
    error?: string | any
    meta?: Record<string, any>
  }): void {
    const level = LogLevel[logEntry.level.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO
    
    // Handle error string from renderer
    let error: Error | undefined = undefined
    if (logEntry.error) {
      try {
        if (typeof logEntry.error === 'string') {
          // Try to parse as JSON first (structured error)
          try {
            const errorData = JSON.parse(logEntry.error)
            error = new Error(errorData.message || 'Unknown error')
            if (errorData.stack) {
              error.stack = errorData.stack
            }
            if (errorData.name) {
              error.name = errorData.name
            }
          } catch (jsonError) {
            // If not JSON, treat as plain error message
            error = new Error(logEntry.error)
          }
        } else if (logEntry.error instanceof Error) {
          error = logEntry.error
        } else if (typeof logEntry.error === 'object' && logEntry.error.message) {
          error = new Error(logEntry.error.message)
          if (logEntry.error.stack) {
            error.stack = logEntry.error.stack
          }
          if (logEntry.error.name) {
            error.name = logEntry.error.name
          }
        } else {
          // Fallback: convert any other type to string
          error = new Error(String(logEntry.error))
        }
      } catch (e) {
        // If all else fails, create a generic error
        error = new Error('Error object could not be processed from renderer')
      }
    }
    
    this.log(level, `[RENDERER] ${logEntry.message}`, logEntry.component, error, logEntry.meta)
  }

  public setLevel(level: LogLevel): void {
    this.minLevel = level
  }

  public getLogDirectory(): string {
    return this.logDir
  }

  public getCurrentLogFile(): string {
    return this.currentLogFile
  }

  // Get recent log entries for debugging
  public getRecentLogs(lines: number = 100): string[] {
    try {
      const content = fs.readFileSync(this.currentLogFile, 'utf8')
      const logLines = content.trim().split('\n').filter(line => line.trim())
      return logLines.slice(-lines)
    } catch (error) {
      return []
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance()