import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Session, Project } from '../../../shared/types'

// Icon components for sessions based on sequence
const sessionIcons = [
  // Terminal/Console icon
  () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M3.5 2.75a.75.75 0 0 0-1.5 0v14.5a.75.75 0 0 0 1.5 0v-4.392l1.657-.348a6.44 6.44 0 0 1 4.271.572 7.94 7.94 0 0 0 5.965.574l.302-.054a.75.75 0 0 0 .537-1.026l-3.21-6.42a.75.75 0 0 0-1.342-.24L10.5 8.25l-2.5-2.5a.75.75 0 0 0-1.06 0l-2.72 2.72V2.75Z" />
    </svg>
  ),
  // Code icon
  () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M6.28 5.22a.75.75 0 0 1 0 1.06L2.56 10l3.72 3.72a.75.75 0 0 1-1.06 1.06L.97 10.53a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Zm7.44 0a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L17.44 10l-3.72-3.72a.75.75 0 0 1 0-1.06ZM9.5 6.75a.75.75 0 0 1 .58.91l-2 7a.75.75 0 1 1-1.49-.34l2-7A.75.75 0 0 1 9.5 6.75Z" clipRule="evenodd" />
    </svg>
  ),
  // Document icon
  () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H4.25Zm0 4a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H4.25Zm0 4a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H4.25Z" clipRule="evenodd" />
    </svg>
  ),
  // Cog/Settings icon
  () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .205 1.251l-1.18 2.044a1 1 0 0 1-1.186.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.205-1.251l1.18-2.044A1 1 0 0 1 3.982 4.03l1.598.54A6.993 6.993 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
    </svg>
  ),
  // Star icon
  () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
    </svg>
  ),
  // Cube icon
  () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M15.5 2A1.5 1.5 0 0 1 17 3.5v9A1.5 1.5 0 0 1 15.5 14h-5a1.5 1.5 0 0 1-1.5-1.5V7a.5.5 0 0 0-.5-.5h-3A1.5 1.5 0 0 1 4 5V2.5A1.5 1.5 0 0 1 5.5 1h9A1.5 1.5 0 0 1 16 2.5v1.05a2.5 2.5 0 0 0-1.5-.55Z" />
    </svg>
  ),
]

const getSessionIcon = (index: number) => {
  const IconComponent = sessionIcons[index % sessionIcons.length]
  return <IconComponent />
}

interface SessionListProps {
  projects: Project[]
  activeSessionId: string | null
  onCreateProject: () => void
  onCreateSession: (projectId: string) => void
  onActivateSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onDeleteProject: (projectId: string) => void
  onOpenSettings?: () => void
  claudeAvailable: boolean
}

const SessionList: React.FC<SessionListProps> = ({
  projects,
  activeSessionId,
  onCreateProject,
  onCreateSession,
  onActivateSession,
  onDeleteSession,
  onDeleteProject,
  onOpenSettings,
  claudeAvailable,
}) => {
  const { t } = useTranslation()
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [currentTime, setCurrentTime] = useState(new Date().getTime())
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, projectId: string} | null>(null)

  // 定时更新时间，用于实时显示倒计时
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().getTime())
    }, 1000) // 每秒更新一次

    return () => clearInterval(timer)
  }, [])

  // Handle clicking outside to close context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [contextMenu])

  // 自动展开当前活跃会话对应的项目（手风琴效果）
  useEffect(() => {
    if (activeSessionId) {
      // 找到活跃会话对应的项目
      const activeProject = projects.find(project => 
        project.sessions.some(session => session.id === activeSessionId)
      )
      
      if (activeProject) {
        setExpandedProjects(prev => {
          // 如果当前活跃项目已经展开，保持现状
          if (prev.has(activeProject.id)) {
            return prev
          }
          
          // 否则关闭所有其他项目，只展开活跃项目（手风琴效果）
          const newExpanded = new Set<string>()
          newExpanded.add(activeProject.id)
          return newExpanded
        })
      }
    }
  }, [activeSessionId, projects])

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const newExpanded = new Set<string>()
      
      // 如果点击的项目已经展开，则关闭所有项目（手风琴效果）
      if (prev.has(projectId)) {
        // 关闭所有项目
        return newExpanded
      } else {
        // 只展开点击的项目，关闭其他所有项目
        newExpanded.add(projectId)
        return newExpanded
      }
    })
  }

  // 检查项目是否包含当前活跃的会话
  const hasActiveSession = (project: Project) => {
    return activeSessionId && project.sessions.some(session => session.id === activeSessionId)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  // 格式化相对时间（倒计时方式）
  const formatRelativeTime = (dateString: string) => {
    const sessionTime = new Date(dateString).getTime()
    const diffInSeconds = Math.floor((currentTime - sessionTime) / 1000)
    
    if (diffInSeconds < 0) {
      return t('sessions.justNow')
    } else if (diffInSeconds < 60) {
      return t('sessions.secondsAgo', { seconds: diffInSeconds })
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return t('sessions.minutesAgo', { minutes })
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return t('sessions.hoursAgo', { hours })
    } else {
      const days = Math.floor(diffInSeconds / 86400)
      return t('sessions.daysAgo', { days })
    }
  }

  // Handle right-click context menu for projects
  const handleProjectContextMenu = (event: React.MouseEvent, projectId: string) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      projectId
    })
  }

  const handleContextMenuAction = async (action: 'newSession' | 'delete', projectId: string) => {
    setContextMenu(null)
    if (action === 'newSession') {
      onCreateSession(projectId)
    } else if (action === 'delete') {
      const project = projects.find(p => p.id === projectId)
      if (project) {
        // Get Claude project directory for more accurate confirmation message
        try {
          const claudeProjectDir = await window.api.getClaudeProjectDirectory(project.path)
          const confirmMessage = claudeProjectDir 
            ? t('sessions.confirmDeleteProject', { 
                projectName: project.name,
                projectPath: project.path,
                claudeProjectDir: claudeProjectDir
              })
            : t('sessions.confirmDeleteProject', { 
                projectName: project.name,
                projectPath: project.path
              })
          
          if (confirm(confirmMessage)) {
            onDeleteProject(projectId)
          }
        } catch (error) {
          // Fallback to original confirmation if API call fails
          if (confirm(t('sessions.confirmDeleteProject', { 
            projectName: project.name,
            projectPath: project.path 
          }))) {
            onDeleteProject(projectId)
          }
        }
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Logo */}
      <div className="flex items-center gap-3 p-4 shrink-0">
        <img 
          src="./cc-copilot-logo.avif" 
          alt="CC Copilot Logo" 
          className="w-8 h-8"
          onError={(e) => {
            // Fallback to SVG if image fails to load
            e.currentTarget.style.display = 'none';
            const svg = e.currentTarget.nextElementSibling;
            //@ts-ignore
            if (svg) svg.style.display = 'block';
          }}
        />
        <svg 
          className="w-8 h-8" 
          style={{ display: 'none', color: 'var(--accent)' }} 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M6.5 10.5L12 15.5L17.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
          <path d="M5.5 5.5H18.5V18.5H5.5V5.5Z" stroke="currentColor" strokeWidth="2"></path>
        </svg>
        <h1 className="text-xl font-bold">CC Copilot</h1>
      </div>

      {/* Project List */}
      <nav className="flex-grow px-2 overflow-y-auto space-y-1">
        {projects.length === 0 ? (
          <div className="p-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
            <p>{t('sessions.noProjects')}</p>
            <p className="text-sm mt-1">{t('sessions.addProjectToStart')}</p>
          </div>
        ) : (
          projects.map((project, projectIndex) => (
            <div key={project.id}>
              {/* Project Header */}
              <div
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-smooth ${
                  expandedProjects.has(project.id) 
                    ? 'bg-opacity-30' 
                    : ''
                }`}
                style={{ 
                  backgroundColor: expandedProjects.has(project.id) ? 'rgba(59, 130, 246, 0.15)' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (!expandedProjects.has(project.id)) {
                    e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!expandedProjects.has(project.id)) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
                onClick={() => toggleProject(project.id)}
                onContextMenu={(e) => handleProjectContextMenu(e, project.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    strokeWidth="2" 
                    stroke="currentColor" 
                    className={`w-4 h-4 shrink-0 transform transition-transform ${expandedProjects.has(project.id) ? 'rotate-90' : ''}`}
                    style={{ color: expandedProjects.has(project.id) ? '#ffffff' : 'var(--text-secondary)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0" style={{ color: expandedProjects.has(project.id) ? '#60a5fa' : 'var(--icon-blue)' }}>
                    <path d="M19.5 21a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H4.5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h15Z" />
                  </svg>
                  <div className="flex flex-col -space-y-1 min-w-0 flex-1">
                    <span className="font-bold text-sm truncate" style={{ color: expandedProjects.has(project.id) ? '#ffffff' : 'var(--text-secondary)' }}>
                      {project.name}
                    </span>
                    <span className="text-xs truncate" style={{ color: expandedProjects.has(project.id) ? 'rgba(255, 255, 255, 0.8)' : 'var(--text-tertiary)' }}>
                      {project.path}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* New Session Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreateSession(project.id)
                    }}
                    className={`${expandedProjects.has(project.id) ? 'opacity-80' : 'opacity-0 group-hover:opacity-100'} p-1 rounded transition-all duration-200`}
                    style={{ color: expandedProjects.has(project.id) ? '#ffffff' : 'var(--text-tertiary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = expandedProjects.has(project.id) ? 'rgba(255, 255, 255, 0.2)' : 'var(--hover-bg)'
                      e.currentTarget.style.color = '#ffffff'
                      e.currentTarget.style.opacity = '1'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = expandedProjects.has(project.id) ? '#ffffff' : 'var(--text-tertiary)'
                      e.currentTarget.style.opacity = expandedProjects.has(project.id) ? '0.8' : '0'
                    }}
                    title={t('sessions.newSession')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                      <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
                    </svg>
                  </button>
                  {/* Status Indicator */}
                  {hasActiveSession(project) && (
                    <div className="status-dot" style={{ backgroundColor: 'var(--status-green)' }}></div>
                  )}
                </div>
              </div>

              {/* Sessions List */}
              {expandedProjects.has(project.id) && (
                <div className="pl-6 pt-1 space-y-0.5">
                  {project.sessions.length === 0 ? (
                    <div className="p-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {t('sessions.noSessionsYet')}
                    </div>
                  ) : (
                    project.sessions.map((session, sessionIndex) => (
                      <div
                        key={session.id}
                        className={`group/session flex items-start justify-between p-2 rounded-md cursor-pointer transition-colors ${
                          activeSessionId === session.id ? '' : ''
                        }`}
                        style={{
                          backgroundColor: activeSessionId === session.id ? 'var(--bg-selection)' : 'transparent',
                          opacity: activeSessionId === session.id ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (activeSessionId !== session.id) {
                            e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeSessionId !== session.id) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }
                        }}
                        onClick={() => onActivateSession(session.id)}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <span className="shrink-0 mt-0.5" style={{ color: activeSessionId === session.id ? '#ffffff' : 'var(--text-secondary)' }}>
                            {getSessionIcon(sessionIndex)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div 
                              className="text-sm font-semibold leading-tight"
                              style={{ 
                                color: activeSessionId === session.id ? '#ffffff' : 'var(--text-secondary)',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                lineHeight: '1.3'
                              }}
                            >
                              {session.name}
                            </div>
                            <div 
                              className="text-xs mt-1" 
                              style={{ 
                                color: activeSessionId === session.id ? 'rgba(255, 255, 255, 0.8)' : 'var(--text-tertiary)' 
                              }}
                            >
                              {formatRelativeTime(session.createdAt || session.lastActiveAt)}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(t('sessions.confirmDelete'))) {
                              onDeleteSession(session.id)
                            }
                          }}
                          className="opacity-0 group-hover/session:opacity-100 transition-opacity hover:text-red-400 mt-0.5 shrink-0"
                          style={{ color: 'var(--text-tertiary)' }}
                          title={t('sessions.deleteSession')}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                            <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </nav>
      
      {/* Bottom Global Actions */}
      <div className="px-2 py-2 shrink-0" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <div className="flex gap-1">
          <button 
            onClick={onCreateProject}
            className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
            <span className="text-sm font-medium">{t('sessions.newProject')}</span>
          </button>
          {onOpenSettings && (
            <button 
              onClick={onOpenSettings}
              className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a6.759 6.759 0 0 1 0 1.255c-.008.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.333.184-.582.496-.645.87l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 0 1-1.37-.49l-1.296-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.759 6.759 0 0 1 0-1.255c.008-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.184.582-.496.645-.87l.212-1.281Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <span className="text-sm font-medium">{t('common.settings')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-48"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            onClick={() => handleContextMenuAction('newSession', contextMenu.projectId)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
            </svg>
            {t('sessions.newSession')}
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" style={{ borderColor: 'var(--border-primary)' }}></div>
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            onClick={() => handleContextMenuAction('delete', contextMenu.projectId)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35L12.95 5.5h.3a.75.75 0 0 0 0-1.5H11V3.25a2.25 2.25 0 0 0-2.25-2.25h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3V3.25a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.712Z" clipRule="evenodd" />
            </svg>
            {t('sessions.deleteProject')}
          </button>
        </div>
      )}
    </div>
  )
}

export default SessionList