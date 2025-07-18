import React, { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'

const Sidebar: React.FC = () => {
  const {
    projects,
    sessions,
    activeProjectId,
    activeSessionId,
    setActiveProject,
    setActiveSession,
    createSession,
    startClaudeCode,
    deleteSession,
    loadSessions,
    setSettingsOpen
  } = useAppStore()

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  // Load sessions when projects change
  useEffect(() => {
    if (activeProjectId) {
      loadSessions(activeProjectId)
    }
  }, [activeProjectId, loadSessions])

  // Auto-expand active project
  useEffect(() => {
    if (activeProjectId) {
      setExpandedProjects(prev => new Set(prev).add(activeProjectId))
    }
  }, [activeProjectId])

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
    } else {
      newExpanded.add(projectId)
      // Load sessions when expanding
      loadSessions(projectId)
    }
    setExpandedProjects(newExpanded)
  }

  const handleCreateSession = async (projectId: string) => {
    try {
      // 创建会话，不传名称参数，让系统自动生成
      await createSession(projectId)
      
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (window.confirm('Are you sure you want to delete this session?')) {
      try {
        await deleteSession(sessionId)
      } catch (error) {
        console.error('Failed to delete session:', error)
      }
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

  const getProjectSessions = (projectId: string) => {
    return sessions.filter(s => s.projectId === projectId)
  }

  const getProjectInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2)
  }

  return (
    <aside className="w-80 flex-shrink-0 bg-gray-800 flex flex-col border-r border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">Projects & Sessions</h1>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="text-center text-gray-400 mt-8 px-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-sm">No projects yet</p>
            <p className="text-xs mt-1">Create your first project</p>
          </div>
        ) : (
          <div className="p-2">
            {projects.map((project) => {
              const projectSessions = getProjectSessions(project.id)
              const isExpanded = expandedProjects.has(project.id)
              const isActive = activeProjectId === project.id

              return (
                <div key={project.id} className="mb-2">
                  {/* Project Header */}
                  <div 
                    className={`group flex items-center p-2 rounded-md cursor-pointer transition-colors ${
                      isActive 
                        ? 'bg-blue-900/50 text-white' 
                        : 'hover:bg-gray-700 text-gray-300'
                    }`}
                    onClick={() => {
                      setActiveProject(project.id).catch(console.error)
                      toggleProject(project.id)
                    }}
                  >
                    {/* Expand/Collapse Icon */}
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className={`h-4 w-4 mr-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>

                    {/* Project Icon */}
                    <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-3">
                      {getProjectInitials(project.name)}
                    </div>

                    {/* Project Name */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium truncate">{project.name}</h3>
                      <p className="text-xs text-gray-400 truncate" title={project.path}>
                        {project.path.split('/').pop()}
                      </p>
                    </div>

                    {/* Session Count */}
                    <div className="text-xs text-gray-400 ml-2">
                      {projectSessions.length}
                    </div>
                  </div>

                  {/* Sessions List */}
                  {isExpanded && (
                    <div className="ml-6 mt-2 space-y-1">
                      {/* New Session Button */}
                      <div className="mb-2">
                        <button
                          onClick={() => handleCreateSession(project.id)}
                          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          New Session
                        </button>
                      </div>

                      {/* Sessions */}
                      {projectSessions.length === 0 ? (
                        <div className="text-center text-gray-400 py-4">
                          <p className="text-xs">No sessions yet</p>
                        </div>
                      ) : (
                        projectSessions.map((session) => (
                          <div
                            key={session.id}
                            className={`group flex items-center p-2 rounded-md cursor-pointer transition-colors ${
                              session.id === activeSessionId
                                ? 'bg-blue-900/30 text-blue-300'
                                : 'hover:bg-gray-700 text-gray-300'
                            }`}
                            onClick={() => {
                              setActiveSession(session.id).catch(console.error)
                            }}
                          >
                            {/* Session Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.013 8.013 0 01-7.93-7M3 12a9 9 0 1118 0z" />
                            </svg>

                            {/* Session Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium truncate">{session.name}</h4>
                              <p className="text-xs text-gray-400">
                                {formatDate(session.createdAt)}
                                {session.history.length > 0 && (
                                  <span className="ml-2">
                                    {session.history.length} msg{session.history.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* Delete Button */}
                            <button
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-red-400 transition-all"
                              title="Delete session"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm py-2 px-3 rounded transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </button>
      </div>
    </aside>
  )
}

export default Sidebar