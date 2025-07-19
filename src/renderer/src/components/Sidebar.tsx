import React, { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'

const Sidebar: React.FC = () => {
  const {
    claudeProjects,
    activeClaudeProjectId,
    activeClaudeSessionId,
    setActiveClaudeProject,
    setActiveClaudeSession,
    loadClaudeProjects,
    resumeClaudeSession,
    selectProjectDirectory,
    extractProjectName,
    createNewProject,
    createNewSession,
    setSettingsOpen
  } = useAppStore()

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  // Auto-expand active Claude project
  useEffect(() => {
    if (activeClaudeProjectId) {
      setExpandedProjects(prev => new Set(prev).add(activeClaudeProjectId))
    }
  }, [activeClaudeProjectId])

  // Load Claude projects on mount and set up refresh interval
  useEffect(() => {
    loadClaudeProjects()
    
    // Refresh every 5 seconds to pick up new projects/sessions
    const interval = setInterval(() => {
      loadClaudeProjects()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [loadClaudeProjects])

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
    } else {
      newExpanded.add(projectId)
    }
    setExpandedProjects(newExpanded)
  }

  const handleRefreshProjects = () => {
    loadClaudeProjects()
  }

  const handleClaudeSessionClick = async (session: any, project: any) => {
    try {
      setActiveClaudeSession(session.id)
      await resumeClaudeSession(session, project)
    } catch (error) {
      console.error('Failed to resume Claude session:', error)
    }
  }

  const handleNewProject = async () => {
    try {
      const path = await selectProjectDirectory()
      if (path) {
        await createNewProject(path)
      }
    } catch (error) {
      console.error('Failed to create new project:', error)
    }
  }

  const handleNewSession = async (projectPath: string) => {
    try {
      await createNewSession(projectPath)
    } catch (error) {
      console.error('Failed to create new session:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <aside className="w-72 bg-claude-sidebar flex flex-col flex-shrink-0">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between h-16 px-4 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 bg-claude-accent rounded-md flex items-center justify-center font-bold text-white text-sm">
            C
          </div>
          <span className="font-semibold text-lg text-white">Claude Code</span>
        </div>
        <button
          onClick={handleRefreshProjects}
          className="p-1.5 text-claude-text-secondary hover:text-claude-text-primary rounded-md hover:bg-claude-border/20 transition-colors"
          title="Refresh projects"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="px-3 pt-2 pb-4">
        <div className="flex space-x-2">
          <button 
            onClick={handleNewProject}
            className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 border border-claude-border text-claude-text-primary rounded-lg hover:bg-claude-border/20 transition-colors"
            title="New Project"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-sm">New Project</span>
          </button>
          <button 
            onClick={() => setSettingsOpen(true)}
            className="flex items-center justify-center px-3 py-2 border border-claude-border text-claude-text-primary rounded-lg hover:bg-claude-border/20 transition-colors"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-4">
        {claudeProjects.length === 0 ? (
          <div className="text-center text-claude-text-secondary mt-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-xs">No Claude Code projects found</p>
            <p className="text-xs mt-1 text-claude-text-secondary/50">
              Run <code className="bg-claude-border/30 px-1 rounded">claude</code> in a directory to create projects
            </p>
          </div>
        ) : (
          claudeProjects.map((project) => {
            const isExpanded = expandedProjects.has(project.id)
            const isActive = activeClaudeProjectId === project.id
            
            return (
              <div key={project.id} className="space-y-2 pt-4">
                <div 
                  className={`group flex items-center justify-between px-2 py-2 rounded-md cursor-pointer transition-colors ${
                    isActive 
                      ? 'bg-claude-accent/20 text-claude-text-primary' 
                      : 'hover:bg-claude-border/20 text-claude-text-secondary'
                  }`}
                  onClick={() => {
                    setActiveClaudeProject(project.id)
                    toggleProject(project.id)
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                    <h3 className="text-sm font-medium">
                      {project.name}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-claude-text-secondary/50 bg-claude-border/30 px-2 py-0.5 rounded">
                      {project.sessions.length}
                    </span>
                  </div>
                </div>
                
                {isExpanded && (
                  <nav className="ml-6 space-y-1">
                    {/* New Session Button for this project */}
                    <div className="mb-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleNewSession(project.path)
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-claude-accent/20 hover:bg-claude-accent/40 text-claude-text-primary text-xs py-1.5 px-2 rounded transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        New Session
                      </button>
                    </div>

                    {/* Sessions List */}
                    {project.sessions.length === 0 ? (
                      <div className="text-center text-claude-text-secondary py-4">
                        <p className="text-xs">No sessions yet</p>
                      </div>
                    ) : (
                      project.sessions.map((session) => (
                        <div
                          key={session.id}
                          className={`group flex flex-col px-2 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
                            session.id === activeClaudeSessionId
                              ? 'bg-claude-accent/60 text-white'
                              : 'text-claude-text-secondary hover:bg-claude-border/40'
                          }`}
                          onClick={() => handleClaudeSessionClick(session, project)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex-1 truncate font-medium">{session.name}</span>
                            <span className="text-xs text-claude-text-secondary/60 ml-2">
                              {formatDate(session.createdAt)}
                            </span>
                          </div>
                          {session.firstMessage && (
                            <p className="text-xs text-claude-text-secondary/50 mt-1 truncate">
                              {session.firstMessage}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </nav>
                )}
              </div>
            )
          })
        )}
      </div>

    </aside>
  )
}

export default Sidebar