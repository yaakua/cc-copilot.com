import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger';
import { app } from 'electron';
import { SettingsManager } from './settings';

import { v4 as uuidv4 } from 'uuid';

export interface Session {
  id: string; 
  name: string;
  projectId: string;
  createdAt: string;
  lastActiveAt: string;
  claudeSessionId?: string; 
  isTemporary: boolean; 
  filePath?: string;
}

export interface Project {
  id: string; 
  name: string;
  path: string;
  createdAt: string;
}

interface StoreData {
  projects: Project[];
  sessions: Session[];
}

export class SessionManager {
  private storePath: string;
  private data: StoreData;
  private settingsManager: SettingsManager | null = null;

  constructor(settingsManager?: SettingsManager) {
    const userDataPath = app.getPath('userData');
    this.storePath = path.join(userDataPath, 'session-store.json');
    this.settingsManager = settingsManager || null;
    this.data = this.load();
  }

  // 设置 SettingsManager（如果构造时没有传入）
  public setSettingsManager(settingsManager: SettingsManager): void {
    this.settingsManager = settingsManager;
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.storePath)) {
        const rawData = fs.readFileSync(this.storePath, 'utf-8');
        return JSON.parse(rawData);
      } else {
        logger.info('Session store not found, creating a new one.', 'SessionManager');
        const initialData: StoreData = { projects: [], sessions: [] };
        this.save(initialData);
        return initialData;
      }
    } catch (error) {
      logger.error('Failed to load session store, resetting.', 'SessionManager', error as Error);
      const backupPath = `${this.storePath}.${Date.now()}.bak`;
      if (fs.existsSync(this.storePath)) {
        fs.renameSync(this.storePath, backupPath);
        logger.info(`Backed up corrupted store to ${backupPath}`, 'SessionManager');
      }
      const initialData: StoreData = { projects: [], sessions: [] };
      this.save(initialData);
      return initialData;
    }
  }

  private save(data: StoreData): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Failed to save session store.', 'SessionManager', error as Error);
    }
  }

  public getProjects(): Project[] {
    // 实时过滤项目，以防设置更改
    if (this.settingsManager) {
      return this.data.projects.filter(project => !this.settingsManager!.shouldHideDirectory(project.path));
    }
    return this.data.projects;
  }

  public getSessions(projectId: string): Session[] {
    return this.data.sessions.filter(s => s.projectId === projectId);
  }

  public getAllSessions(): Session[] {
    return this.data.sessions;
  }

  public getProjectById(projectId: string): Project | undefined {
    return this.data.projects.find(p => p.id === projectId);
  }

  public getSessionById(sessionId: string): Session | undefined {
    return this.data.sessions.find(s => s.id === sessionId);
  }

  public addProject(project: Project): void {
    // 检查项目路径是否应该被过滤
    if (this.settingsManager && this.settingsManager.shouldHideDirectory(project.path)) {
      logger.info(`项目被过滤无法添加: ${project.name} at ${project.path}`, 'SessionManager');
      return;
    }
    
    if (!this.data.projects.some(p => p.id === project.id)) {
      this.data.projects.push(project);
      this.save(this.data);
      logger.info(`Project added: ${project.name}`, 'SessionManager');
    }
  }

  public addSession(session: Session): void {
    if (!this.data.sessions.some(s => s.id === session.id)) {
      this.data.sessions.push(session);
      this.save(this.data);
      logger.info(`Session added: ${session.name}`, 'SessionManager');
    }
  }

  public updateSession(sessionId: string, updates: Partial<Session>): Session | undefined {
    const sessionIndex = this.data.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex !== -1) {
      const updatedSession = { ...this.data.sessions[sessionIndex], ...updates };
      this.data.sessions[sessionIndex] = updatedSession;
      this.save(this.data);
      logger.info(`Session updated: ${sessionId}`, 'SessionManager');
      return updatedSession;
    }
    logger.warn(`Session not found for update: ${sessionId}`, 'SessionManager');
    return undefined;
  }

  public syncWithClaudeDirectory(): void {
    const claudeDir = path.join(os.homedir(), '.claude');
    const projectsDir = path.join(claudeDir, 'projects');

    if (!fs.existsSync(claudeDir)) {
      logger.info('Claude directory not found, skipping sync.', 'SessionManager');
      return;
    }

    logger.info('Syncing with Claude directory...', 'SessionManager');
    
    // Clear existing data and reload from Claude directory
    this.data.projects = [];
    this.data.sessions = [];
    
    let projectsSynced = 0;
    let sessionsSynced = 0;

    // Sync Projects and Sessions from ~/.claude/projects/
    if (fs.existsSync(projectsDir)) {
      const projectFolders = fs.readdirSync(projectsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      for (const projectFolder of projectFolders) {
        try {
          const projectFolderPath = path.join(projectsDir, projectFolder);
          const allSessionFiles = fs.readdirSync(projectFolderPath).filter(f => f.endsWith('.jsonl'));
          const sessionFiles = allSessionFiles
            .map(file => ({
              name: file,
              path: path.join(projectFolderPath, file),
              stats: fs.statSync(path.join(projectFolderPath, file))
            }))
            .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()) // Sort by modification time (newest first)
            .slice(0, 20) // Limit to 20 most recent sessions
            .map(item => item.name);
          
          if (allSessionFiles.length > 20) {
            logger.info(`Project ${projectFolder} has ${allSessionFiles.length} sessions, loading latest 20`, 'SessionManager');
          }
          
          let project: Project | undefined;
          let projectPath: string | undefined;
          let projectName: string | undefined;
          let earliestTimestamp: string | undefined;
          
          // First pass: find project information from any session file that has cwd
          for (const sessionFile of sessionFiles) {
            if (projectPath) break; // Already found project info
            
            try {
              const sessionFilePath = path.join(projectFolderPath, sessionFile);
              const sessionData = fs.readFileSync(sessionFilePath, 'utf-8')
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => JSON.parse(line));
              
              // Find the first entry with cwd
              const entryWithCwd = sessionData.find(entry => entry.cwd);
              if (entryWithCwd) {
                projectPath = entryWithCwd.cwd;
                projectName = path.basename(projectPath||"");
                earliestTimestamp = entryWithCwd.timestamp;
                logger.debug(`Found project info in folder ${projectFolder}: ${projectName} at ${projectPath}`, 'SessionManager');
                break;
              }
            } catch (error) {
              logger.error(`Failed to read session file: ${sessionFile}`, 'SessionManager', error as Error);
            }
          }
          
          // Create project if we found project info
          if (projectPath && projectName) {
            // 检查项目路径是否应该被过滤
            if (this.settingsManager && this.settingsManager.shouldHideDirectory(projectPath)) {
              logger.info(`项目被过滤跳过: ${projectName} at ${projectPath}`, 'SessionManager');
              continue;
            }
            
            // Since we cleared data, check if project already exists (in case of duplicate cwd paths)
            project = this.data.projects.find(p => p.path === projectPath);
            if (!project) {
              let createdAt: string;
              try {
                createdAt = earliestTimestamp ? new Date(earliestTimestamp).toISOString() : new Date().toISOString();
              } catch (error) {
                createdAt = new Date().toISOString();
              }
              
              project = {
                id: uuidv4(),
                name: projectName,
                path: projectPath,
                createdAt: createdAt,
              };
              this.data.projects.push(project);
              projectsSynced++;
              logger.debug(`Created project: ${projectName} (${project.id}) from ${projectPath}`, 'SessionManager');
            }
          } else {
            logger.warn(`No project info found in folder: ${projectFolder}`, 'SessionManager');
          }
          
          // Second pass: process each session file for sessions
          for (const sessionFile of sessionFiles) {
            if (!project) continue; // Skip if no project found
            
            try {
              const sessionFilePath = path.join(projectFolderPath, sessionFile);
              const sessionData = fs.readFileSync(sessionFilePath, 'utf-8')
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => JSON.parse(line));
              
              if (sessionData.length > 0) {
                const firstEntry = sessionData[0];
                
                // Process session
                const claudeSessionId = firstEntry.sessionId;
                let session = this.data.sessions.find(s => s.claudeSessionId === claudeSessionId);
                
                const firstUserMessage = sessionData.find(msg => msg.type === 'user');
                const lastMessage = sessionData[sessionData.length - 1];
                
                let sessionName = `Session ${claudeSessionId}`;
                if (firstUserMessage && firstUserMessage.message && firstUserMessage.message.content) {
                  let content: string;
                  if (typeof firstUserMessage.message.content === 'string') {
                    content = firstUserMessage.message.content;
                  } else if (Array.isArray(firstUserMessage.message.content)) {
                    // Handle content array format
                    const textContent = firstUserMessage.message.content.find((item: any) => item.type === 'text');
                    content = textContent ? textContent.text : String(firstUserMessage.message.content);
                  } else {
                    content = String(firstUserMessage.message.content);
                  }
                  
                  // Clean up content and create session name
                  content = content.replace(/cd\s+"[^"]*"|cd\s+\S+/g, '').trim(); // Remove cd commands
                  content = content.replace(/\n|\r/g, ' ').trim(); // Replace newlines with spaces
                  if (content.length > 3) {
                    sessionName = content.substring(0, 50).trim();
                  }
                }
                
                logger.debug(`Session name for ${claudeSessionId}: "${sessionName}"`, 'SessionManager');
                
                let lastActiveAt: string;
                try {
                  lastActiveAt = lastMessage && lastMessage.timestamp 
                    ? new Date(lastMessage.timestamp).toISOString() 
                    : new Date(firstEntry.timestamp).toISOString();
                } catch (error) {
                  lastActiveAt = new Date().toISOString();
                }
                
                // Since we cleared data, create all sessions as new (but check for duplicates by claudeSessionId)
                if (!session) {
                  let createdAt: string;
                  try {
                    createdAt = firstEntry.timestamp ? new Date(firstEntry.timestamp).toISOString() : new Date().toISOString();
                  } catch (error) {
                    createdAt = new Date().toISOString();
                  }
                  
                  session = {
                    id: uuidv4(),
                    name: sessionName,
                    projectId: project.id,
                    createdAt: createdAt,
                    lastActiveAt: lastActiveAt,
                    claudeSessionId: claudeSessionId,
                    isTemporary: false,
                    filePath: sessionFilePath,
                  };
                  this.data.sessions.push(session);
                  sessionsSynced++;
                }
              }
            } catch (error) {
              logger.error(`Failed to process session file: ${sessionFile}`, 'SessionManager', error as Error);
            }
          }
        } catch (error) {
          logger.error(`Failed to process project folder: ${projectFolder}`, 'SessionManager', error as Error);
        }
      }
    }

    this.save(this.data);
    logger.info(`Sync complete. Loaded ${projectsSynced} projects and ${sessionsSynced} sessions from Claude directory.`, 'SessionManager');
  }

  public deleteSession(sessionId: string): void {
    const initialLength = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter(s => s.id !== sessionId);
    if (this.data.sessions.length < initialLength) {
      this.save(this.data);
      logger.info(`Session deleted: ${sessionId}`, 'SessionManager');
    }
  }

  public deleteProject(projectId: string): void {
    const initialLength = this.data.projects.length;
    this.data.projects = this.data.projects.filter(p => p.id !== projectId);
    this.data.sessions = this.data.sessions.filter(s => s.projectId !== projectId);
    if (this.data.projects.length < initialLength) {
      this.save(this.data);
      logger.info(`Project and its sessions deleted: ${projectId}`, 'SessionManager');
    }
  }
}