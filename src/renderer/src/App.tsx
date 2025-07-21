import React, { useState, useEffect } from 'react'
import SessionList from './components/SessionList'
import TabManager from './components/TabManager'
import StatusBar from './components/StatusBar'
import ErrorBoundary from './components/ErrorBoundary'
import Settings from './components/Settings'
import { logger } from './utils/logger'

interface Session {
  id: string
  name: string
  projectPath: string
  createdAt: string
  lastActiveAt: string
  filePath: string
  claudeProjectId?: string
  claudeProjectDir?: string
}

interface Project {
  path: string
  name: string
  sessions: Session[]
}

interface ClaudeDetectionResult {
  isInstalled: boolean
  version?: string
  path?: string
  error?: string
  timestamp: number
}

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeSessionIds, setActiveSessionIds] = useState<string[]>([])
  const [currentActiveSessionId, setCurrentActiveSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [claudeDetectionResult, setClaudeDetectionResult] = useState<ClaudeDetectionResult | null>(null)
  const [claudeDetecting, setClaudeDetecting] = useState(false)

  // Load initial data
  useEffect(() => {
    logger.setComponent('App')
    logger.info('App组件已挂载')
    loadProjects()
    loadClaudeDetectionResult()

    // Set up Claude detection result listener
    const removeClaudeListener = window.api.onClaudeDetectionResult((result: ClaudeDetectionResult) => {
      logger.info('收到Claude检测结果', result)
      setClaudeDetectionResult(result)
      setClaudeDetecting(false)
    })

    // Set up terminal closed listener
    const removeTerminalClosedListener = window.api.onTerminalClosed((eventData: { sessionId: string; error: boolean }) => {
      logger.info('Received terminal:closed event', { eventData })
      
      // Remove session from active tabs
      setActiveSessionIds(prev => prev.filter(id => id !== eventData.sessionId))
      
      // If this was the current active session, switch to another tab or clear
      if (currentActiveSessionId === eventData.sessionId) {
        setActiveSessionIds(prev => {
          const remaining = prev.filter(id => id !== eventData.sessionId)
          setCurrentActiveSessionId(remaining.length > 0 ? remaining[remaining.length - 1] : null)
          return remaining
        })
        
        if (eventData.error) {
          logger.warn('Claude session closed unexpectedly')
        } else {
          logger.info('Claude session ended normally')
        }
      }
    })

    const removeSessionCreatedListener = window.api.onSessionCreated((newSession: Session) => {
      logger.info('Received session:created event', { newSession });

      // Add the new session to the appropriate project
      setProjects(prevProjects => {
        const projectExists = prevProjects.some(p => p.path === newSession.projectPath);
        if (projectExists) {
          return prevProjects.map(p => 
            p.path === newSession.projectPath 
              ? { ...p, sessions: [...p.sessions, newSession] } 
              : p
          );
        } else {
          // If project doesn't exist, create it
          const newProject: Project = {
            path: newSession.projectPath,
            name: newSession.projectPath.split('/').pop() || 'New Project',
            sessions: [newSession]
          };
          return [...prevProjects, newProject];
        }
      });

      // Add to active sessions and set as current
      setActiveSessionIds(prev => {
        if (!prev.includes(newSession.id)) {
          return [...prev, newSession.id];
        }
        return prev;
      });
      setCurrentActiveSessionId(newSession.id);
    });

    const removeSessionUpdatedListener = window.api.onSessionUpdated((updateData: { oldId: string; newSession: Session }) => {
      logger.info('Received session:updated event', { updateData });

      // Update session ID in projects
      setProjects(prevProjects => {
        return prevProjects.map(project => ({
          ...project,
          sessions: project.sessions.map(session => 
            session.id === updateData.oldId 
              ? { ...session, ...updateData.newSession }
              : session
          )
        }));
      });

      // Update active session IDs
      setActiveSessionIds(prev => {
        return prev.map(id => id === updateData.oldId ? updateData.newSession.id : id);
      });

      // Update current active session ID
      if (currentActiveSessionId === updateData.oldId) {
        setCurrentActiveSessionId(updateData.newSession.id);
      }
    });

    return () => {
      removeClaudeListener();
      removeTerminalClosedListener();
      removeSessionCreatedListener();
      removeSessionUpdatedListener();
    };
  }, [currentActiveSessionId])

  const loadClaudeDetectionResult = async () => {
    try {
      const result = await window.api.getClaudeDetectionResult()
      if (result) {
        setClaudeDetectionResult(result)
        logger.info('获取到Claude检测结果', result)
      }
    } catch (error) {
      logger.error('获取Claude检测结果失败', error as Error)
    }
  }

  const loadProjects = async () => {
    try {
      logger.info('从主进程加载项目')
      // Load projects directly from main process (includes Claude projects)
      const allProjects = await window.api.getAllProjects()
      console.log('###所有项目', allProjects)  
      setProjects(allProjects)
      
      logger.info('项目加载成功', { 
        projectCount: allProjects.length,
        sessionCount: allProjects.reduce((acc: number, p: any) => acc + p.sessions.length, 0)
      })
    } catch (error) {
      logger.error('加载项目失败', error as Error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async () => {
    try {
      // Check if Claude is available before creating project
      if (!claudeDetectionResult?.isInstalled) {
        logger.warn('Claude CLI未安装，无法创建项目')
        alert(`无法创建项目: Claude CLI未检测到\n\n错误: ${claudeDetectionResult?.error || '未知错误'}\n\n请安装Claude CLI后重新检测。`)
        return
      }

      logger.info('创建新项目')
      const projectPath = await window.api.selectProjectDirectory()
      if (!projectPath) {
        logger.info('用户取消了项目创建')
        return
      }

      logger.info('选择了项目目录', { projectPath })

      // Create new project using the API
      const project = await window.api.createProject(projectPath)
      logger.info('项目创建成功', { project })

      // Create a new session for this project
      const session = await window.api.createSession(project.path, 'New Session')
      
      // Explicitly activate the session to ensure proper IPC setup
      await window.api.activateSession(session.id)
      
      // Add to active sessions and set as current
      setActiveSessionIds(prev => {
        if (!prev.includes(session.id)) {
          return [...prev, session.id]
        }
        return prev
      })
      setCurrentActiveSessionId(session.id)
      
      logger.info('项目和会话创建并激活成功', { 
        projectId: project.id, 
        sessionId: session.id 
      })
      
      // Don't reload projects immediately - let the terminal show first
      // Will reload projects later when Claude creates actual session files
      logger.info('新项目会话已激活，应显示终端', { sessionId: session.id })
    } catch (error) {
      logger.error('创建项目失败', error as Error)
    }
  }

  const handleCreateSession = async (projectPath: string) => {
    try {
      // Check if Claude is available before creating session
      if (!claudeDetectionResult?.isInstalled) {
        logger.warn('Claude CLI未安装，无法创建会话')
        alert(`无法创建会话: Claude CLI未检测到\n\n错误: ${claudeDetectionResult?.error || '未知错误'}\n\n请安装Claude CLI后重新检测。`)
        return
      }

      logger.info('创建新会话', { projectPath })
      const session = await window.api.createSession(projectPath)
      
      // Explicitly activate the session to ensure proper IPC setup
      await window.api.activateSession(session.id)
      
      // Add to active sessions and set as current
      setActiveSessionIds(prev => {
        if (!prev.includes(session.id)) {
          return [...prev, session.id]
        }
        return prev
      })
      setCurrentActiveSessionId(session.id)
      logger.info('会话创建并激活成功', { sessionId: session.id })
      
      // Don't reload projects immediately for new sessions
      // The session will eventually appear in Claude projects after Claude creates session files
      logger.info('新会话已激活，应显示终端', { sessionId: session.id })
    } catch (error) {
      logger.error('创建会话失败', error as Error)
    }
  }

  const handleActivateSession = async (sessionId: string) => {
    try {
      // If session is already in active tabs, just switch to it
      if (activeSessionIds.includes(sessionId)) {
        setCurrentActiveSessionId(sessionId)
        return
      }

      // Find the session
      let session: Session | undefined
      for (const project of projects) {
        session = project.sessions.find(s => s.id === sessionId)
        if (session) break
      }

      logger.info('激活会话', { 
        sessionId, 
        projectPath: session?.projectPath
      })

      if (session?.filePath) {
        // For existing Claude sessions, use resume with the file path
        await window.api.resumeSession(sessionId, session.projectPath)
        logger.info('Claude会话已恢复', { sessionId, filePath: session.filePath })
      } else {
        // For new sessions, use normal activate
        await window.api.activateSession(sessionId)
        logger.info('会话已激活', { sessionId })
      }
      
      // Add to active sessions and set as current
      setActiveSessionIds(prev => {
        if (!prev.includes(sessionId)) {
          return [...prev, sessionId]
        }
        return prev
      })
      setCurrentActiveSessionId(sessionId)
    } catch (error) {
      logger.error('激活会话失败', error as Error, { sessionId })
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      logger.info('删除会话', { sessionId })
      const deletionResult = await window.api.deleteSession(sessionId)
      
      // Remove from active sessions
      setActiveSessionIds(prev => prev.filter(id => id !== sessionId))
      
      // If this was the current active session, switch to another tab or clear
      if (currentActiveSessionId === sessionId) {
        setActiveSessionIds(prev => {
          const remaining = prev.filter(id => id !== sessionId)
          setCurrentActiveSessionId(remaining.length > 0 ? remaining[remaining.length - 1] : null)
          return remaining
        })
      }
      
      if (deletionResult.success) {
        logger.info('会话和相关文件删除成功', { 
          sessionId, 
          details: deletionResult.details 
        })
      } else {
        logger.info('会话删除失败或不完整', { 
          error: deletionResult.error,
          details: deletionResult.details
        })
      }
      
      // Always reload projects after deletion to refresh the session list
      await loadProjects()
    } catch (error) {
      logger.error('删除会话失败', error as Error, { sessionId })
      // Still try to reload projects in case of partial deletion
      await loadProjects()
    }
  }

  const handleCloseTab = (sessionId: string) => {
    // Remove from active sessions
    setActiveSessionIds(prev => prev.filter(id => id !== sessionId))
    
    // If this was the current active session, switch to another tab or clear
    if (currentActiveSessionId === sessionId) {
      setActiveSessionIds(prev => {
        const remaining = prev.filter(id => id !== sessionId)
        setCurrentActiveSessionId(remaining.length > 0 ? remaining[remaining.length - 1] : null)
        return remaining
      })
    }
  }

  const handleOpenSettings = () => {
    setShowSettings(true)
  }

  const handleRedetectClaude = async () => {
    try {
      setClaudeDetecting(true)
      logger.info('重新检测Claude CLI')
      const result = await window.api.redetectClaude()
      logger.info('Claude重新检测完成', result)
      // The result will be set via the listener
    } catch (error) {
      logger.error('Claude重新检测失败', error as Error)
      setClaudeDetecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-900 text-white items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Session List */}
          <div className="w-80 bg-gray-800 border-r border-gray-700">
            <SessionList
              projects={projects}
              activeSessionId={currentActiveSessionId}
              onCreateProject={handleCreateProject}
              onCreateSession={handleCreateSession}
              onActivateSession={handleActivateSession}
              onDeleteSession={handleDeleteSession}
              onOpenSettings={handleOpenSettings}
              claudeAvailable={claudeDetectionResult?.isInstalled === true}
            />
          </div>
          
          {/* Right Content - TabManager */}
          <TabManager
            projects={projects}
            activeSessionIds={activeSessionIds}
            currentActiveSessionId={currentActiveSessionId}
            onActivateSession={setCurrentActiveSessionId}
            onCloseTab={handleCloseTab}
          />
        </div>
        
        {/* Bottom Status Bar */}
        <StatusBar activeSessionId={currentActiveSessionId} />
        
        {/* Settings Modal */}
        {showSettings && (
          <Settings
            claudeDetectionResult={claudeDetectionResult}
            claudeDetecting={claudeDetecting}
            onRedetectClaude={handleRedetectClaude}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App