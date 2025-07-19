export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  filename?: string
  line?: number
  error?: string
  meta?: any
}

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  logDir?: string
  maxFiles?: string
  maxSize?: string
  enableConsole?: boolean
}

export interface Logger {
  debug: (message: string, meta?: any) => void
  info: (message: string, meta?: any) => void
  warn: (message: string, meta?: any) => void
  error: (message: string, error?: Error | any, meta?: any) => void
}