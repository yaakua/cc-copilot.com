interface LogEntry {
  timestamp: string
  level: string
  message: string
  filename?: string
  line?: number
  error?: string
  meta?: any
}

function getCallerInfo(): { filename?: string; line?: number } {
  try {
    const stack = new Error().stack
    if (!stack) return {}
    
    const lines = stack.split('\n')
    // Skip first 3 lines: Error, getCallerInfo, and the log function
    const callerLine = lines[3]
    
    if (callerLine) {
      const match = callerLine.match(/\((.*):(\d+):(\d+)\)/) || callerLine.match(/at (.*):(\d+):(\d+)/)
      if (match) {
        const fullPath = match[1]
        const filename = fullPath.split('/').pop() || fullPath
        const line = parseInt(match[2], 10)
        return { filename, line }
      }
    }
  } catch (e) {
    // Ignore errors in stack trace parsing
  }
  
  return {}
}

function formatTimestamp(): string {
  const now = new Date()
  return now.toISOString().replace('T', ' ').replace('Z', '')
}

function sendLogToMain(entry: LogEntry): void {
  if (window.electronAPI?.sendLog) {
    window.electronAPI.sendLog(entry)
  }
}

function logToConsole(level: string, message: string, meta?: any): void {
  const timestamp = formatTimestamp()
  const caller = getCallerInfo()
  const location = caller.filename && caller.line ? ` [${caller.filename}:${caller.line}]` : ''
  const formattedMessage = `${timestamp} [${level.toUpperCase()}]${location} ${message}`
  
  switch (level) {
    case 'debug':
      console.debug(formattedMessage, meta)
      break
    case 'info':
      console.info(formattedMessage, meta)
      break
    case 'warn':
      console.warn(formattedMessage, meta)
      break
    case 'error':
      console.error(formattedMessage, meta)
      break
    default:
      console.log(formattedMessage, meta)
  }
}

export const logger = {
  debug: (message: string, meta?: any) => {
    const caller = getCallerInfo()
    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level: 'debug',
      message,
      filename: caller.filename,
      line: caller.line,
      meta
    }
    
    logToConsole('debug', message, meta)
    sendLogToMain(entry)
  },
  
  info: (message: string, meta?: any) => {
    const caller = getCallerInfo()
    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level: 'info',
      message,
      filename: caller.filename,
      line: caller.line,
      meta
    }
    
    logToConsole('info', message, meta)
    sendLogToMain(entry)
  },
  
  warn: (message: string, meta?: any) => {
    const caller = getCallerInfo()
    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level: 'warn',
      message,
      filename: caller.filename,
      line: caller.line,
      meta
    }
    
    logToConsole('warn', message, meta)
    sendLogToMain(entry)
  },
  
  error: (message: string, error?: Error | any, meta?: any) => {
    const caller = getCallerInfo()
    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level: 'error',
      message,
      filename: caller.filename,
      line: caller.line,
      error: error instanceof Error ? error.stack : String(error),
      meta
    }
    
    logToConsole('error', message, { error, ...meta })
    sendLogToMain(entry)
  }
}

// 全局错误捕获
window.addEventListener('error', (event) => {
  logger.error('Uncaught error', event.error, {
    filename: event.filename,
    line: event.lineno,
    column: event.colno
  })
})

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', event.reason)
})

export default logger