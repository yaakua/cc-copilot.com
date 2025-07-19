import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

const logDir = path.join(app.getPath('userData'), 'logs')

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, filename, line }) => {
    const location = filename && line ? ` [${filename}:${line}]` : ''
    return `${timestamp} [${level.toUpperCase()}]${location} ${stack || message}`
  })
)

const dailyRotateFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: customFormat
})

const errorFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: customFormat
})

export const mainLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: customFormat,
  transports: [
    dailyRotateFileTransport,
    errorFileTransport,
    ...(process.env.NODE_ENV === 'development' 
      ? [new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })]
      : []
    )
  ]
})

function getCallerInfo() {
  const originalFunc = Error.prepareStackTrace
  let callerInfo = ''
  
  try {
    const err = new Error()
    Error.prepareStackTrace = (_, stack) => stack
    
    const stack = err.stack as unknown as NodeJS.CallSite[]
    if (stack && stack.length > 3) {
      const caller = stack[3]
      const fileName = caller.getFileName()
      const lineNumber = caller.getLineNumber()
      
      if (fileName && lineNumber) {
        callerInfo = `${path.basename(fileName)}:${lineNumber}`
      }
    }
  } catch (e) {
    // Ignore errors in stack trace parsing
  } finally {
    Error.prepareStackTrace = originalFunc
  }
  
  return callerInfo
}

export const logger = {
  debug: (message: string, meta?: any) => {
    const caller = getCallerInfo()
    mainLogger.debug(message, { ...meta, filename: caller.split(':')[0], line: caller.split(':')[1] })
  },
  info: (message: string, meta?: any) => {
    const caller = getCallerInfo()
    mainLogger.info(message, { ...meta, filename: caller.split(':')[0], line: caller.split(':')[1] })
  },
  warn: (message: string, meta?: any) => {
    const caller = getCallerInfo()
    mainLogger.warn(message, { ...meta, filename: caller.split(':')[0], line: caller.split(':')[1] })
  },
  error: (message: string, error?: Error | any, meta?: any) => {
    const caller = getCallerInfo()
    mainLogger.error(message, { 
      ...meta, 
      error: error instanceof Error ? error.stack : error,
      filename: caller.split(':')[0], 
      line: caller.split(':')[1] 
    })
  }
}

export default logger