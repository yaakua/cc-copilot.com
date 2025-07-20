import Store from 'electron-store'
import { app } from 'electron'
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
  isClaudeSession?: boolean
  filePath?: string
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

interface StoreSchema {
  projects: Project[]
  sessions: Session[]
}

export class DataStore {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      defaults: {
        projects: [],
        sessions: []
      },
      cwd: app.getPath('userData'),
      name: 'data'
    })
  }

  // Session management
  createSession(projectPath: string, name: string, id?: string): Session {
    const session: Session = {
      id: id || `session-${Date.now()}`,
      name,
      projectPath,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    }

    const sessions = this.store.get('sessions', [])
    sessions.push(session)
    this.store.set('sessions', sessions)

    return session
  }

  getSessions(projectPath: string): Session[] {
    const sessions = this.store.get('sessions', [])
    return sessions.filter(s => s.projectPath === projectPath)
  }

  getSessionById(id: string): Session | undefined {
    const sessions = this.store.get('sessions', [])
    return sessions.find(s => s.id === id)
  }

  updateSessionActivity(id: string): void {
    const sessions = this.store.get('sessions', [])
    const session = sessions.find(s => s.id === id)
    if (session) {
      session.lastActiveAt = new Date().toISOString()
      this.store.set('sessions', sessions)
    }
  }

  deleteSession(id: string): void {
    const sessions = this.store.get('sessions', [])
    const filtered = sessions.filter(s => s.id !== id)
    this.store.set('sessions', filtered)
  }

  // Project management
  getProjects(): Project[] {
    const sessions = this.store.get('sessions', [])
    const projectMap = new Map<string, Project>()

    // Group sessions by project path
    sessions.forEach(session => {
      const existing = projectMap.get(session.projectPath)
      if (existing) {
        existing.sessions.push(session)
      } else {
        projectMap.set(session.projectPath, {
          path: session.projectPath,
          name: this.extractProjectName(session.projectPath),
          sessions: [session]
        })
      }
    })

    return Array.from(projectMap.values())
  }

  private extractProjectName(path: string): string {
    return path.split('/').pop() || path
  }

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

  // 获取所有项目（包括Claude项目和本地项目）
  getAllProjects(): Project[] {
    const localProjects = this.getProjects()
    const claudeProjects = this.getClaudeProjects()
    
    // 将Claude项目转换为统一的Project格式
    const claudeProjectsAsProjects: Project[] = claudeProjects.map(claudeProject => ({
      path: claudeProject.path,
      name: claudeProject.name,
      sessions: claudeProject.sessions.map(claudeSession => ({
        id: claudeSession.id,
        name: claudeSession.name,
        projectPath: claudeProject.path,
        createdAt: claudeSession.createdAt,
        lastActiveAt: claudeSession.createdAt,
        isClaudeSession: true,
        filePath: claudeSession.filePath
      }))
    }))
    
    // 合并本地项目和Claude项目，去重
    const allProjects = [...localProjects]
    
    for (const claudeProject of claudeProjectsAsProjects) {
      const existingProject = allProjects.find(p => p.path === claudeProject.path)
      if (existingProject) {
        // 合并会话，Claude会话优先
        const claudeSessions = claudeProject.sessions
        const localSessions = existingProject.sessions.filter(s => !s.isClaudeSession)
        existingProject.sessions = [...claudeSessions, ...localSessions]
      } else {
        allProjects.push(claudeProject)
      }
    }
    
    return allProjects
  }
}