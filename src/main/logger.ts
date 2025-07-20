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
          console.warn(`Failed to delete old log file ${file.name}:`, error)
        }
      })
    } catch (error) {
      console.warn('Failed to clean old logs:', error)
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
        error: entry.error ? {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack
        } : undefined,
        meta: entry.meta
      }) + '\n'

      fs.appendFileSync(this.currentLogFile, logLine)
    } catch (error) {
      console.error('Failed to write to log file:', error)
    }
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString()
    const level = LogLevel[entry.level].padEnd(5)
    const component = entry.component ? `[${entry.component}]` : '[main]'
    
    let message = `${timestamp} ${level} ${component} ${entry.message}`
    
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      message += ` ${JSON.stringify(entry.meta)}`
    }
    
    return message
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
      meta
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
    error?: any
    meta?: Record<string, any>
  }): void {
    const level = LogLevel[logEntry.level.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO
    const error = logEntry.error ? new Error(logEntry.error.message || logEntry.error) : undefined
    
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
      const content = fs.readFileSync(this.currentLogFile, 'utf-8')
      const logLines = content.trim().split('\n').filter(line => line.trim())
      return logLines.slice(-lines)
    } catch (error) {
      return []
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance()