import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger';
import { app } from 'electron';

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

  constructor() {
    const userDataPath = app.getPath('userData');
    this.storePath = path.join(userDataPath, 'session-store.json');
    this.data = this.load();
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
    let projectsSynced = 0;
    let sessionsSynced = 0;
    let dataChanged = false;

    // Sync Projects and Sessions from ~/.claude/projects/
    if (fs.existsSync(projectsDir)) {
      const projectFolders = fs.readdirSync(projectsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      for (const projectFolder of projectFolders) {
        try {
          const projectFolderPath = path.join(projectsDir, projectFolder);
          const sessionFiles = fs.readdirSync(projectFolderPath).filter(f => f.endsWith('.jsonl'));
          
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
                break;
              }
            } catch (error) {
              logger.error(`Failed to read session file: ${sessionFile}`, 'SessionManager', error as Error);
            }
          }
          
          // Create or find project if we found project info
          if (projectPath && projectName) {
            project = this.data.projects.find(p => p.path === projectPath);
            if (!project) {
              project = {
                id: uuidv4(),
                name: projectName,
                path: projectPath,
                createdAt: new Date(earliestTimestamp || Date.now()).toISOString(),
              };
              this.data.projects.push(project);
              projectsSynced++;
              dataChanged = true;
            } else if (project.name !== projectName) {
              project.name = projectName;
              dataChanged = true;
            }
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
                  sessionName = firstUserMessage.message.content.substring(0, 50).replace(/\n/g, ' ').trim();
                }
                const lastActiveAt = lastMessage ? new Date(lastMessage.timestamp).toISOString() : new Date(firstEntry.timestamp).toISOString();
                
                if (!session) {
                  session = {
                    id: uuidv4(),
                    name: sessionName,
                    projectId: project.id,
                    createdAt: new Date(firstEntry.timestamp).toISOString(),
                    lastActiveAt: lastActiveAt,
                    claudeSessionId: claudeSessionId,
                    isTemporary: false,
                    filePath: sessionFilePath,
                  };
                  this.data.sessions.push(session);
                  sessionsSynced++;
                  dataChanged = true;
                } else {
                  let sessionUpdated = false;
                  if (session.name !== sessionName) {
                    session.name = sessionName;
                    sessionUpdated = true;
                  }
                  if (session.lastActiveAt !== lastActiveAt) {
                    session.lastActiveAt = lastActiveAt;
                    sessionUpdated = true;
                  }
                  if (sessionUpdated) {
                    this.updateSession(session.id, session);
                    dataChanged = true;
                  }
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

    if (dataChanged) {
      this.save(this.data);
      logger.info(`Sync complete. Synced ${projectsSynced} projects and ${sessionsSynced} sessions.`, 'SessionManager');
    } else {
      logger.info('Sync complete. No changes detected.', 'SessionManager');
    }
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