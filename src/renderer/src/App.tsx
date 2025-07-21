import React, { useState, useEffect } from 'react'
import SessionList from './components/SessionList'
import TabManager from './components/TabManager'
import StatusBar from './components/StatusBar'
import ErrorBoundary from './components/ErrorBoundary'
import Settings from './components/Settings'
import { logger } from './utils/logger'
import { Session, Project, ClaudeDetectionResult } from '../../shared/types'

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
    loadClaudeDetectionResult
    const removeClaudeListener = window.api.onClaudeDetectionResult((result: ClaudeDetectionResult) => {
      logger.info('收到Claude检测结果', result)
      setClaudeDetectionResult(result)
      setClaudeDetecting(false)
    })

    const removeTerminalClosedListener = window.api.onTerminalClosed((eventData: { sessionId: string; error: boolean }) => {
      logger.info('Received terminal:closed event', { eventData })

      setActiveSessionIds(prevActiveIds => {
        const remainingIds = prevActiveIds.filter(id => id !== eventData.sessionId)

        setCurrentActiveSessionId(prevCurrentId => {
          if (prevCurrentId === eventData.sessionId) {
            if (eventData.error) {
              logger.warn('Claude session closed unexpectedly')
            } else {
              logger.info('Claude session ended normally')
            }
            return remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null
          }
          return prevCurrentId
        })

        return remainingIds
      })
    })

    const removeSessionCreatedListener = window.api.onSessionCreated((newSession: Session) => {
      logger.info('Received session:created event', { newSession })
      setProjects(prevProjects => {
        const projectIndex = prevProjects.findIndex(p => p.id === newSession.projectId)
        if (projectIndex === -1) {
          logger.info('Received session for a non-existent project', { sessionId: newSession.id, projectId: newSession.projectId })
          return prevProjects
        }

        const newProjects = [...prevProjects]
        const project = { ...newProjects[projectIndex] }

        if (!project.sessions.some(s => s.id === newSession.id)) {
          project.sessions = [...project.sessions, newSession].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          newProjects[projectIndex] = project
        }

        return newProjects
      })

      setActiveSessionIds(prev => [...prev, newSession.id])
      setCurrentActiveSessionId(newSession.id)
    })

    const removeSessionUpdatedListener = window.api.onSessionUpdated((updateData: { oldId: string; newSession: Session }) => {
      logger.info('Received session:updated event', { updateData })

      setProjects(prevProjects => {
        const projectIndex = prevProjects.findIndex(p => p.sessions.some(s => s.id === updateData.oldId))

        if (projectIndex === -1) {
          logger.info('Received session:updated for a session not found in any project', { updateData })
          return prevProjects
        }

        const newProjects = [...prevProjects]
        const projectToUpdate = { ...newProjects[projectIndex] }

        projectToUpdate.sessions = projectToUpdate.sessions
          .map(s => (s.id === updateData.oldId ? updateData.newSession : s))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        newProjects[projectIndex] = projectToUpdate
        return newProjects
      })

      setActiveSessionIds(prev => prev.map(id => (id === updateData.oldId ? updateData.newSession.id : id)))

      setCurrentActiveSessionId(prevCurrentId => {
        if (prevCurrentId === updateData.oldId) {
          return updateData.newSession.id
        }
        return prevCurrentId
      })
    })

    const removeSessionDeletedListener = window.api.onSessionDeleted((sessionId: string) => {
      logger.info('Received session:deleted event', { sessionId })

      setProjects(prevProjects =>
        prevProjects.map(p => ({
          ...p,
          sessions: p.sessions.filter(s => s.id !== sessionId),
        }))
      )

      setActiveSessionIds(prevActiveIds => {
        const remainingIds = prevActiveIds.filter(id => id !== sessionId)

        setCurrentActiveSessionId(prevCurrentId => {
          if (prevCurrentId === sessionId) {
            return remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null
          }
          return prevCurrentId
        })

        return remainingIds
      })
    })

    const removeProjectCreatedListener = window.api.onProjectCreated((newProject: Project) => {
      logger.info('Received project:created event', { newProject })
      setProjects(prev => {
        if (!prev.some(p => p.id === newProject.id)) {
          return [...prev, { ...newProject, sessions: [] }]
        }
        return prev
      })
    })

    return () => {
      removeClaudeListener()
      removeTerminalClosedListener()
      removeSessionCreatedListener()
      removeSessionUpdatedListener()
      removeSessionDeletedListener()
      removeProjectCreatedListener()
    }
  }, [])

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

      // The backend will create the project and an initial session.
      // The UI will be updated via `project:created` and `session:created` events.
      const { project } = await window.api.createProject(projectPath);
      logger.info('项目创建请求已发送', { project });

      // If a new project was created, create a session for it
      if (project) {
        await handleCreateSession(project.id);
      }
    } catch (error) {
      logger.error('创建项目失败', error as Error)
    }
  }

  const handleCreateSession = async (projectId: string) => {
    try {
      // Check if Claude is available before creating session
      if (!claudeDetectionResult?.isInstalled) {
        logger.warn('Claude CLI未安装，无法创建会话')
        alert(`无法创建会话: Claude CLI未检测到\n\n错误: ${claudeDetectionResult?.error || '未知错误'}\n\n请安装Claude CLI后重新检测。`)
        return
      }

      logger.info('创建新会话', { projectId });
      // The backend will create the session.
      // The UI will be updated via the `session:created` event.
      await window.api.createSession(projectId);
      logger.info('新会话创建请求已发送');
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

      logger.info('激活会话', { sessionId });

      await window.api.activateSession(sessionId);
      logger.info('会话激活请求已发送', { sessionId });

      // Add to active sessions and set as current
      setActiveSessionIds(prev => {
        if (!prev.includes(sessionId)) {
          return [...prev, sessionId];
        }
        return prev;
      });
      setCurrentActiveSessionId(sessionId);
    } catch (error) {
      logger.error('激活会话失败', error as Error, { meta: { sessionId } })
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      logger.info('请求删除会话', { sessionId });
      await window.api.deleteSession(sessionId);
      // The UI will be updated via the `session:deleted` event.
    } catch (error) {
      logger.error('删除会话失败', error as Error, { meta: { sessionId } })
    }
  }

  const handleCloseTab = (sessionId: string) => {
    setActiveSessionIds(prevActiveIds => {
      const remainingIds = prevActiveIds.filter(id => id !== sessionId);
      
      setCurrentActiveSessionId(prevCurrentId => {
        if (prevCurrentId === sessionId) {
          // The closed tab was the active one.
          // We need to determine the new active tab.
          // The old logic was to select the last one. Let's stick to that.
          return remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null;
        }
        // The active tab was not the one that was closed.
        return prevCurrentId;
      });

      return remainingIds;
    });
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