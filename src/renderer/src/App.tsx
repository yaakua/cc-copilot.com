import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import SessionList from './components/SessionList'
import TabManager from './components/TabManager'
import StatusBar from './components/StatusBar'
import ErrorBoundary from './components/ErrorBoundary'
import Settings from './components/Settings'
import AuthDialog from './components/AuthDialog'
import { logger } from './utils/logger'
import { Session, Project, ClaudeDetectionResult } from '../../shared/types'
import './i18n'

const App: React.FC = () => {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<Project[]>([])
  const [activeSessionIds, setActiveSessionIds] = useState<string[]>([])
  const [currentActiveSessionId, setCurrentActiveSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [claudeDetectionResult, setClaudeDetectionResult] = useState<ClaudeDetectionResult | null>(null)
  const [claudeDetecting, setClaudeDetecting] = useState(false)
  const [authDialog, setAuthDialog] = useState<{ isOpen: boolean; error: string; loginInstructions: string }>({
    isOpen: false,
    error: '',
    loginInstructions: ''
  })

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

        // Find and remove any temporary sessions for this project
        const tempSessionIndex = project.sessions.findIndex(s => s.isLoading && s.isTemporary && s.projectId === newSession.projectId)
        
        if (tempSessionIndex !== -1) {
          // Replace temp session with real session
          const tempSessionId = project.sessions[tempSessionIndex].id
          project.sessions[tempSessionIndex] = newSession
          
          // Update activeSessionIds to replace temp id with real id
          setActiveSessionIds(prev => 
            prev.map(id => id === tempSessionId ? newSession.id : id)
          )
          
          // Update current active session id
          setCurrentActiveSessionId(prevCurrentId => 
            prevCurrentId === tempSessionId ? newSession.id : prevCurrentId
          )
        } else if (!project.sessions.some(s => s.id === newSession.id)) {
          // No temp session found, add as new session
          project.sessions = [newSession, ...project.sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          setActiveSessionIds(prev => [...prev, newSession.id])
          setCurrentActiveSessionId(newSession.id)
        }

        newProjects[projectIndex] = project
        return newProjects
      })
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

    const removeProjectDeletedListener = window.api.onProjectDeleted((projectId: string) => {
      logger.info('Received project:deleted event', { projectId })
      
      setProjects(prev => prev.filter(p => p.id !== projectId))
      
      // Remove any active sessions that belonged to this project
      setActiveSessionIds(prevActiveIds => {
        const project = projects.find(p => p.id === projectId)
        if (!project) return prevActiveIds
        
        const projectSessionIds = project.sessions.map(s => s.id)
        const remainingIds = prevActiveIds.filter(id => !projectSessionIds.includes(id))
        
        setCurrentActiveSessionId(prevCurrentId => {
          if (prevCurrentId && projectSessionIds.includes(prevCurrentId)) {
            return remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null
          }
          return prevCurrentId
        })
        
        return remainingIds
      })
    })

    const removeSessionAuthRequiredListener = window.api.onSessionAuthRequired((authData: { error: string; loginInstructions: string }) => {
      logger.warn('Session creation failed due to authentication:', authData.error)
      
      // Show authentication dialog
      setAuthDialog({
        isOpen: true,
        error: authData.error,
        loginInstructions: authData.loginInstructions
      })
      
      // Also send the login instructions to the terminal if there's an active session
      if (currentActiveSessionId) {
        const formattedMessage = `\x1b[31m认证失败: ${authData.error}\x1b[0m\n\n\x1b[33m${authData.loginInstructions}\x1b[0m\n`
        window.api.sendSystemMessage(formattedMessage, currentActiveSessionId)
      }
    })

    return () => {
      removeClaudeListener()
      removeTerminalClosedListener()
      removeSessionCreatedListener()
      removeSessionUpdatedListener()
      removeSessionDeletedListener()
      removeProjectCreatedListener()
      removeProjectDeletedListener()
      removeSessionAuthRequiredListener()
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
        alert(t('alerts.claudeNotInstalled', { error: claudeDetectionResult?.error || t('common.unknown') }))
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
        alert(t('alerts.sessionCreationFailed', { error: claudeDetectionResult?.error || t('common.unknown') }))
        return
      }

      logger.info('创建新会话', { projectId });
      
      // Create a temporary loading session immediately
      const tempSessionId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const tempSession: Session = {
        id: tempSessionId,
        name: t('sessions.creating'),
        projectId,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        isTemporary: true,
        isLoading: true
      }
      
      // Add temp session to projects state
      setProjects(prevProjects => {
        const projectIndex = prevProjects.findIndex(p => p.id === projectId)
        if (projectIndex === -1) return prevProjects
        
        const newProjects = [...prevProjects]
        const project = { ...newProjects[projectIndex] }
        project.sessions = [tempSession, ...project.sessions]
        newProjects[projectIndex] = project
        return newProjects
      })
      
      // Add to active sessions and set as current
      setActiveSessionIds(prev => [...prev, tempSessionId])
      setCurrentActiveSessionId(tempSessionId)
      
      // Send request to backend
      // The UI will be updated via the `session:created` event.
      const result = await window.api.createSession(projectId);
      
      // Check if authentication failed
      if (result && typeof result === 'object' && 'error' in result) {
        logger.warn('会话创建失败，需要认证', result)
        // Clean up temp session when auth fails
        setActiveSessionIds(prev => prev.filter(id => id !== tempSessionId))
        setProjects(prevProjects => 
          prevProjects.map(p => ({
            ...p,
            sessions: p.sessions.filter(s => s.id !== tempSessionId)
          }))
        )
        return
      }
      
      logger.info('新会话创建请求已发送');
    } catch (error) {
      logger.error('创建会话失败', error as Error)
      // Clean up temp session on error
      setActiveSessionIds(prev => prev.filter(id => !id.startsWith('temp-')))
      setProjects(prevProjects => 
        prevProjects.map(p => ({
          ...p,
          sessions: p.sessions.filter(s => !s.id.startsWith('temp-'))
        }))
      )
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

      if (!session) {
        logger.error('找不到要激活的会话', { sessionId })
        return
      }

      logger.info('激活会话', { sessionId });

      // Set session to loading state immediately
      setProjects(prevProjects => 
        prevProjects.map(p => ({
          ...p,
          sessions: p.sessions.map(s => 
            s.id === sessionId ? { ...s, isLoading: true } : s
          )
        }))
      )

      // Add to active sessions and set as current
      setActiveSessionIds(prev => {
        if (!prev.includes(sessionId)) {
          return [...prev, sessionId];
        }
        return prev;
      });
      setCurrentActiveSessionId(sessionId);

      await window.api.activateSession(sessionId);
      logger.info('会话激活请求已发送', { sessionId });

      // Clear loading state after a short delay (terminal should be ready)
      setTimeout(() => {
        setProjects(prevProjects => 
          prevProjects.map(p => ({
            ...p,
            sessions: p.sessions.map(s => 
              s.id === sessionId ? { ...s, isLoading: false } : s
            )
          }))
        )
      }, 1000)
    } catch (error) {
      logger.error('激活会话失败', error as Error, { meta: { sessionId } })
      // Clear loading state on error
      setProjects(prevProjects => 
        prevProjects.map(p => ({
          ...p,
          sessions: p.sessions.map(s => 
            s.id === sessionId ? { ...s, isLoading: false } : s
          )
        }))
      )
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

  const handleDeleteProject = async (projectId: string) => {
    try {
      logger.info('请求删除项目', { projectId });
      await window.api.deleteProject(projectId);
      // The UI will be updated via the `project:deleted` event.
    } catch (error) {
      logger.error('删除项目失败', error as Error, { meta: { projectId } })
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
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div>{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {/* Custom drag area - show on all platforms for consistency */}
        <div 
          className="h-6 shrink-0 drag-region"
          style={{ 
            backgroundColor: 'var(--bg-primary)',
            WebkitAppRegion: 'drag' as any
          }}
        />
        
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Session List */}
          <div className="w-80 flex flex-col shrink-0" style={{ backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-primary)' }}>
            <SessionList
              projects={projects}
              activeSessionId={currentActiveSessionId}
              onCreateProject={handleCreateProject}
              onCreateSession={handleCreateSession}
              onActivateSession={handleActivateSession}
              onDeleteSession={handleDeleteSession}
              onDeleteProject={handleDeleteProject}
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
        
        {/* Authentication Dialog */}
        <AuthDialog
          isOpen={authDialog.isOpen}
          error={authDialog.error}
          loginInstructions={authDialog.loginInstructions}
          onClose={() => setAuthDialog({ isOpen: false, error: '', loginInstructions: '' })}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>
    </ErrorBoundary>
  )
}

export default App