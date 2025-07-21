import React, { useState, useEffect } from 'react'
import SessionList from './components/SessionList'
import Terminal from './components/Terminal'
import StatusBar from './components/StatusBar'
import ErrorBoundary from './components/ErrorBoundary'
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

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Load initial data
  useEffect(() => {
    logger.setComponent('App')
    logger.info('App component mounted')
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      logger.info('Loading projects from main process')
      // Load projects directly from main process (includes Claude projects)
      const allProjects = await window.api.getAllProjects()
      console.log('###allProjects', allProjects)  
      setProjects(allProjects)
      
      logger.info('Projects loaded successfully', { 
        projectCount: allProjects.length,
        sessionCount: allProjects.reduce((acc, p) => acc + p.sessions.length, 0)
      })
    } catch (error) {
      logger.error('Failed to load projects', error as Error)
    } finally {
      setLoading(false)
    }
  }

  const extractProjectName = (path: string): string => {
    return path.split('/').pop() || path
  }

  const handleCreateProject = async () => {
    try {
      logger.info('Creating new project')
      const projectPath = await window.api.selectProjectDirectory()
      if (!projectPath) {
        logger.info('Project creation cancelled by user')
        return
      }

      logger.info('Selected project directory', { projectPath })

      // Create new project using the API
      const project = await window.api.createProject(projectPath)
      logger.info('Project created successfully', { project })

      // Create a new session for this project
      const session = await window.api.createSession(project.path, 'New Session')
      setActiveSessionId(session.id)
      
      logger.info('Project and session created successfully', { 
        projectId: project.id, 
        sessionId: session.id 
      })
      
      // Reload projects
      await loadProjects()
    } catch (error) {
      logger.error('Failed to create project', error as Error)
    }
  }

  const handleCreateSession = async (projectPath: string) => {
    try {
      logger.info('Creating new session', { projectPath })
      const session = await window.api.createSession(projectPath)
      setActiveSessionId(session.id)
      logger.info('Session created successfully', { sessionId: session.id })
      await loadProjects()
    } catch (error) {
      logger.error('Failed to create session', error as Error)
    }
  }

  const handleActivateSession = async (sessionId: string) => {
    try {
      // Find the session
      let session: Session | undefined
      for (const project of projects) {
        session = project.sessions.find(s => s.id === sessionId)
        if (session) break
      }

      logger.info('Activating session', { 
        sessionId, 
        projectPath: session?.projectPath
      })

      if (session?.filePath) {
        // For existing Claude sessions, use resume with the file path
        await window.api.resumeSession(sessionId, session.projectPath)
        logger.info('Claude session resumed', { sessionId, filePath: session.filePath })
      } else {
        // For new sessions, use normal activate
        await window.api.activateSession(sessionId)
        logger.info('Session activated', { sessionId })
      }
      
      setActiveSessionId(sessionId)
    } catch (error) {
      logger.error('Failed to activate session', error as Error, { sessionId })
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      logger.info('Deleting session', { sessionId })
      const deletionResult = await window.api.deleteSession(sessionId)
      
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
      }
      
      if (deletionResult.success) {
        logger.info('Session and associated files deleted successfully', { 
          sessionId, 
          details: deletionResult.details 
        })
      } else {
        logger.info('Session deletion failed or incomplete', { 
          error: deletionResult.error,
          details: deletionResult.details
        })
      }
      
      // Always reload projects after deletion to refresh the session list
      await loadProjects()
    } catch (error) {
      logger.error('Failed to delete session', error as Error, { sessionId })
      // Still try to reload projects in case of partial deletion
      await loadProjects()
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
              activeSessionId={activeSessionId}
              onCreateProject={handleCreateProject}
              onCreateSession={handleCreateSession}
              onActivateSession={handleActivateSession}
              onDeleteSession={handleDeleteSession}
            />
          </div>
          
          {/* Right Content - Terminal */}
          <div className="flex-1 flex flex-col">
            {activeSessionId ? (
              <Terminal sessionId={activeSessionId} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <h2 className="text-xl mb-2">No Active Session</h2>
                  <p>Select a session from the sidebar or create a new project</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom Status Bar */}
        <StatusBar activeSessionId={activeSessionId} />
      </div>
    </ErrorBoundary>
  )
}

export default App