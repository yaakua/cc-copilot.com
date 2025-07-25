export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

class RendererLogger {
  private component: string = 'renderer'

  public setComponent(component: string): void {
    this.component = component
  }

  private async log(level: LogLevel, message: string, error?: Error, meta?: Record<string, any>): Promise<void> {
    try {
      if (window.api?.log) {
        // Completely serialize error as string for IPC transmission
        let errorString: string | undefined = undefined
        if (error) {
          try {
            // Create a comprehensive error string
            errorString = JSON.stringify({
              message: error.message || 'Unknown error',
              stack: error.stack || 'No stack trace available',
              name: error.name || 'Error',
              toString: error.toString()
            }, null, 2)
          } catch (serializationError) {
            // Fallback if JSON.stringify fails
            errorString = `Error: ${error.message || error.toString() || 'Unknown error'}`
          }
        }
        await window.api.log(level, message, this.component, errorString, meta)
      } else {
        // Fallback to console if API not available
        const logMethod = console[level] || console.log
        logMethod(`[${this.component}] ${message}`, meta || '', error || '')
      }
    } catch (err) {
      console.error('发送日志到主进程失败:', err)
      console[level](`[${this.component}] ${message}`, meta || '', error || '')
    }
  }

  public debug(message: string, meta?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, undefined, meta)
  }

  public info(message: string, meta?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, undefined, meta)
  }

  public warn(message: string, error?: Error, meta?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, error, meta)
  }

  public error(message: string, error?: Error, meta?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, error, meta)
  }

  // Convenience methods for component-specific logging
  public withComponent(component: string) {
    return {
      debug: (message: string, meta?: Record<string, any>) => 
        this.log(LogLevel.DEBUG, message, undefined, { ...meta, originalComponent: this.component, component }),
      info: (message: string, meta?: Record<string, any>) => 
        this.log(LogLevel.INFO, message, undefined, { ...meta, originalComponent: this.component, component }),
      warn: (message: string, error?: Error, meta?: Record<string, any>) => 
        this.log(LogLevel.WARN, message, error, { ...meta, originalComponent: this.component, component }),
      error: (message: string, error?: Error, meta?: Record<string, any>) => 
        this.log(LogLevel.ERROR, message, error, { ...meta, originalComponent: this.component, component })
    }
  }

  // Get recent logs for debugging
  public async getRecentLogs(lines?: number): Promise<string[]> {
    try {
      if (window.api?.getRecentLogs) {
        return await window.api.getRecentLogs(lines)
      }
      return []
    } catch (error) {
      console.error('获取最近日志失败:', error)
      return []
    }
  }

  // Get log directory
  public async getLogDirectory(): Promise<string> {
    try {
      if (window.api?.getLogDirectory) {
        return await window.api.getLogDirectory()
      }
      return ''
    } catch (error) {
      console.error('获取日志目录失败:', error)
      return ''
    }
  }
}

// Export singleton instance
export const logger = new RendererLogger()

// Replace console methods to redirect to our logger
const originalConsole = {
  log: console.log,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error
}

// Override console methods to also log to file
console.debug = (...args: any[]) => {
  originalConsole.debug(...args)
  logger.debug(args.join(' '))
}

console.info = (...args: any[]) => {
  originalConsole.info(...args)
  logger.info(args.join(' '))
}

console.warn = (...args: any[]) => {
  originalConsole.warn(...args)
  const error = args.find(arg => arg instanceof Error)
  logger.warn(args.filter(arg => !(arg instanceof Error)).join(' '), error)
}

console.error = (...args: any[]) => {
  originalConsole.error(...args)
  const error = args.find(arg => arg instanceof Error)
  logger.error(args.filter(arg => !(arg instanceof Error)).join(' '), error)
}

// Keep console.log unchanged for development debugging
console.log = originalConsole.log