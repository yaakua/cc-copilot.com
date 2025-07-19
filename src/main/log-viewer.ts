import { app, ipcMain } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { logger } from './logger'

export class LogViewer {
  private logDir: string

  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs')
    this.setupIpcHandlers()
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('logs:get-files', async () => {
      try {
        const files = await fs.readdir(this.logDir)
        const logFiles = files.filter(file => file.endsWith('.log'))
        const fileStats = await Promise.all(
          logFiles.map(async (file) => {
            const filePath = path.join(this.logDir, file)
            const stats = await fs.stat(filePath)
            return {
              name: file,
              path: filePath,
              size: stats.size,
              modified: stats.mtime.toISOString()
            }
          })
        )
        return fileStats.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
      } catch (error) {
        logger.error('Failed to get log files', error)
        return []
      }
    })

    ipcMain.handle('logs:read-file', async (_, filePath: string, lines: number = 100) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const logLines = content.split('\n').filter(line => line.trim())
        return logLines.slice(-lines).join('\n')
      } catch (error) {
        logger.error('Failed to read log file', error, { filePath })
        throw error
      }
    })

    ipcMain.handle('logs:clear-logs', async () => {
      try {
        const files = await fs.readdir(this.logDir)
        const logFiles = files.filter(file => file.endsWith('.log'))
        
        await Promise.all(
          logFiles.map(file => fs.unlink(path.join(this.logDir, file)))
        )
        
        logger.info('All log files cleared')
        return true
      } catch (error) {
        logger.error('Failed to clear log files', error)
        throw error
      }
    })

    ipcMain.handle('logs:get-log-dir', () => {
      return this.logDir
    })
  }
}