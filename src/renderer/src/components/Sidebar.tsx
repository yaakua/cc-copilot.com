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
  const [isCollapsed, setIsCollapsed] = useState(false)

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

  // Generate consistent colors for projects
  const getProjectColor = (projectName: string) => {
    const colors = [
      'bg-blue-600',
      'bg-green-600', 
      'bg-purple-600',
      'bg-red-600',
      'bg-yellow-600',
      'bg-indigo-600',
      'bg-pink-600',
      'bg-cyan-600'
    ]
    let hash = 0
    for (let i = 0; i < projectName.length; i++) {
      hash = ((hash << 5) - hash) + projectName.charCodeAt(i)
      hash = hash & hash
    }
    return colors[Math.abs(hash) % colors.length]
  }

  const getProjectTextColor = (projectName: string) => {
    const colors = [
      'text-blue-100',
      'text-green-100',
      'text-purple-100', 
      'text-red-100',
      'text-yellow-100',
      'text-indigo-100',
      'text-pink-100',
      'text-cyan-100'
    ]
    let hash = 0
    for (let i = 0; i < projectName.length; i++) {
      hash = ((hash << 5) - hash) + projectName.charCodeAt(i)
      hash = hash & hash
    }
    return colors[Math.abs(hash) % colors.length]
  }

  // Group sessions by project
  const getAllSessions = () => {
    const allSessions = []
    for (const project of projects) {
      const projectSessions = sessions.filter(s => s.projectId === project.id)
      for (const session of projectSessions) {
        allSessions.push({
          ...session,
          projectName: project.name,
          projectColor: getProjectColor(project.name),
          projectTextColor: getProjectTextColor(project.name)
        })
      }
    }
    return allSessions
  }

  const activeProject = projects.find(p => p.id === activeProjectId)

  // Group sessions by project
  const sessionsByProject = projects.reduce((acc, project) => {
    acc[project.id] = sessions.filter(s => s.projectId === project.id)
    return acc
  }, {} as Record<string, typeof sessions>)

  return (
    <aside className="w-72 bg-claude-sidebar flex flex-col flex-shrink-0">
      {/* Sidebar Header */}
      <div className="flex items-center space-x-2 h-16 px-4 flex-shrink-0">
        <div className="w-7 h-7 bg-claude-accent rounded-md flex items-center justify-center font-bold text-white text-sm">
          C
        </div>
        <span className="font-semibold text-lg text-white">CC Copilot</span>
      </div>

      {/* New Session Button & Session List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-4">
        <button 
          onClick={() => activeProjectId && handleCreateSession(activeProjectId)}
          disabled={!activeProjectId}
          className="w-full flex items-center justify-start space-x-2 mt-2 px-3 py-2 border border-claude-border text-claude-text-primary rounded-lg hover:bg-claude-border/20 transition-colors disabled:border-claude-border/30 disabled:text-claude-text-secondary disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Session</span>
        </button>

        {/* Project Groups */}
        {projects.length === 0 ? (
          <div className="text-center text-claude-text-secondary mt-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-xs">No projects yet</p>
          </div>
        ) : (
          projects.map((project) => {
            const projectSessions = sessionsByProject[project.id] || []
            return (
              <div key={project.id} className="space-y-2 pt-4">
                <h3 className="px-2 text-sm font-medium text-claude-text-secondary/70 uppercase tracking-wider">
                  {project.name}
                </h3>
                <nav className="space-y-1">
                  {projectSessions.map((session) => (
                    <a
                      key={session.id}
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setActiveSession(session.id).catch(console.error)
                      }}
                      className={`block px-2 py-1.5 text-sm rounded-md truncate transition-colors ${
                        session.id === activeSessionId
                          ? 'bg-claude-border/60 text-white'
                          : 'text-claude-text-secondary hover:bg-claude-border/40'
                      }`}
                    >
                      {session.name}
                    </a>
                  ))}
                </nav>
              </div>
            )
          })
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="flex-shrink-0 border-t border-claude-border h-8 px-4 flex items-center">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            setSettingsOpen(true)
          }}
          className="flex items-center space-x-2 text-xs text-claude-text-secondary hover:bg-claude-border/40 px-2 py-0.5 rounded-md transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Settings</span>
        </a>
      </div>
    </aside>
  )
}

export default Sidebar