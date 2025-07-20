import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { logger } from './logger'

export interface Session {
  id: string
  name: string
  projectPath: string
  createdAt: string
  lastActiveAt: string
  filePath: string
  claudeProjectId: string
  claudeProjectDir: string
}

export interface Project {
  path: string
  name: string
  sessions: Session[]
}

export interface ClaudeProject {
  id: string
  name: string
  path: string
  sessionsDir: string
  sessions: ClaudeSession[]
}

export interface ClaudeSession {
  id: string
  name: string
  filePath: string
  createdAt: string
  firstMessage?: string
}

export class DataStore {
  constructor() {
    // No local store needed - we only work with Claude sessions
  }

  deleteSession(id: string): { success: boolean; error?: string; details?: string } {
    logger.info(`Starting deleteSession for id: ${id}`, 'store')
    
    // Find session in Claude projects
    const allProjects = this.getAllProjects()
    let targetSession: Session | undefined
    
    for (const project of allProjects) {
      targetSession = project.sessions.find(s => s.id === id)
      if (targetSession) {
        logger.info(`Found Claude session ${id} in project: ${project.name}`, 'store')
        break
      }
    }
    
    if (!targetSession) {
      const message = `Claude session not found: ${id}`
      logger.warn(message, 'store')
      return { success: false, error: 'Session not found', details: message }
    }
    
    // Delete the Claude session file
    try {
      if (fs.existsSync(targetSession.filePath)) {
        fs.unlinkSync(targetSession.filePath)
        logger.info(`Deleted Claude session file: ${targetSession.filePath}`, 'store')
        return { 
          success: true, 
          details: `Claude session file deleted: ${targetSession.filePath}` 
        }
      } else {
        logger.warn(`Claude session file not found: ${targetSession.filePath}`, 'store')
        return { 
          success: false, 
          error: 'Session file not found', 
          details: `Claude session file not found: ${targetSession.filePath}` 
        }
      }
    } catch (error) {
      const err = error as Error
      logger.error(`Failed to delete Claude session file: ${targetSession.filePath}`, 'store', err)
      return { 
        success: false, 
        error: `File deletion failed: ${err.message}`, 
        details: `Failed to delete ${targetSession.filePath}: ${err.message}` 
      }
    }
  }

  // Only Claude projects are supported

  // Claude Code Integration
  getClaudeProjects(): ClaudeProject[] {
    try {
      const claudeDir = path.join(os.homedir(), '.claude')
      const projectsDir = path.join(claudeDir, 'projects')
      
      if (!fs.existsSync(projectsDir)) {
        logger.info(`Claude projects directory not found: ${projectsDir}`, 'store')
        return []
      }
      
      const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
      
      const projects: ClaudeProject[] = []
      
      for (const projectDirName of projectDirs) {
        const projectDirPath = path.join(projectsDir, projectDirName)
        const sessions = this.getClaudeSessionsForProject(projectDirPath)
        
        // 从第一个会话文件中获取项目路径
        let projectPath = projectDirName
        if (sessions.length > 0) {
          const firstSessionPath = sessions[0].filePath
          const cwd = this.extractCwdFromSession(firstSessionPath)
          if (cwd) {
            projectPath = cwd
          }
        }
        
        const project: ClaudeProject = {
          id: projectDirName,
          name: path.basename(projectPath),
          path: projectPath,
          sessionsDir: projectDirPath,
          sessions
        }
        
        projects.push(project)
      }
      
      return projects
    } catch (error) {
      logger.error('Error reading Claude projects', 'store', error as Error)
      return []
    }
  }

  private getClaudeSessionsForProject(projectDir: string): ClaudeSession[] {
    try {
      const sessionFiles = fs.readdirSync(projectDir)
        .filter(file => file.endsWith('.jsonl'))
        .sort((a, b) => {
          // 按文件修改时间排序，最新的在前
          const aPath = path.join(projectDir, a)
          const bPath = path.join(projectDir, b)
          const aStat = fs.statSync(aPath)
          const bStat = fs.statSync(bPath)
          return bStat.mtime.getTime() - aStat.mtime.getTime()
        })
      
      const sessions: ClaudeSession[] = []
      
      for (const sessionFile of sessionFiles) {
        const sessionPath = path.join(projectDir, sessionFile)
        const sessionId = path.basename(sessionFile, '.jsonl')
        const stats = fs.statSync(sessionPath)
        
        // Log session creation for debugging
        logger.debug(`Creating Claude session: id=${sessionId}, file=${sessionFile}, path=${sessionPath}`, 'store')
        
        // 读取第一行来获取会话的第一条消息
        const firstMessage = this.getFirstMessageFromSession(sessionPath)
        const sessionName = this.generateSessionName(firstMessage, sessions.length + 1)
        
        sessions.push({
          id: sessionId,
          name: sessionName,
          filePath: sessionPath,
          createdAt: stats.birthtime.toISOString(),
          firstMessage
        })
      }
      
      return sessions
    } catch (error) {
      logger.error('Error reading Claude sessions', 'store', error as Error)
      return []
    }
  }

  private extractCwdFromSession(sessionPath: string): string | null {
    try {
      const content = fs.readFileSync(sessionPath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line)
          // Claude Code 会话文件中的 cwd 在 user 或 assistant 类型的消息中
          if (event.cwd) {
            return event.cwd
          }
        } catch (e) {
          // 忽略解析错误的行
          continue
        }
      }
      
      return null
    } catch (error) {
      logger.error('Error extracting cwd from session', 'store', error as Error)
      return null
    }
  }

  private getFirstMessageFromSession(sessionPath: string): string | undefined {
    try {
      const content = fs.readFileSync(sessionPath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line)
          // 查找用户类型的消息
          if (event.type === 'user' && event.message && event.message.content) {
            const content = event.message.content
            let text = ''
            
            // 处理 content 数组格式
            if (Array.isArray(content)) {
              const textContent = content.find(item => item.type === 'text')
              if (textContent && textContent.text) {
                text = textContent.text
              }
            } else if (typeof content === 'string') {
              text = content
            }
            
            if (text) {
              // 返回前50个字符作为预览，去掉换行符
              const preview = text.replace(/\n/g, ' ').trim()
              return preview.slice(0, 50) + (preview.length > 50 ? '...' : '')
            }
          }
        } catch (e) {
          // 忽略解析错误的行
          continue
        }
      }
      
      return undefined
    } catch (error) {
      logger.error('Error reading first message from session', 'store', error as Error)
      return undefined
    }
  }

  private generateSessionName(firstMessage?: string, sessionNumber?: number): string {
    if (firstMessage && firstMessage.trim()) {
      // 使用第一条消息的前30个字符作为会话名称
      return firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '')
    }
    
    return `Session ${sessionNumber || 1}`
  }

  // 获取所有项目（只有Claude项目）
  getAllProjects(): Project[] {
    const claudeProjects = this.getClaudeProjects()
    
    logger.info(`Found ${claudeProjects.length} Claude projects`, 'store')
    
    // 将Claude项目转换为统一的Project格式
    const projects: Project[] = claudeProjects.map(claudeProject => {
      logger.debug(`Converting Claude project: ${claudeProject.name} with ${claudeProject.sessions.length} sessions`, 'store')
      
      return {
        path: claudeProject.path,
        name: claudeProject.name,
        sessions: claudeProject.sessions.map(claudeSession => ({
          id: claudeSession.id,
          name: claudeSession.name,
          projectPath: claudeProject.path,
          createdAt: claudeSession.createdAt,
          lastActiveAt: claudeSession.createdAt,
          filePath: claudeSession.filePath,
          claudeProjectId: claudeProject.id,
          claudeProjectDir: claudeProject.sessionsDir
        }))
      }
    })
    
    return projects
  }
}