import React, { useState } from 'react'
import { Session, Project } from '../../../shared/types'

interface SessionListProps {
  projects: Project[]
  activeSessionId: string | null
  onCreateProject: () => void
  onCreateSession: (projectId: string) => void
  onActivateSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
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
  onOpenSettings,
  claudeAvailable,
}) => {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
    } else {
      newExpanded.add(projectId)
    }
    setExpandedProjects(newExpanded)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          <div className="flex gap-2">
            <button
              onClick={onCreateProject}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
              title="Add New Project"
            >
              +
            </button>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm transition-colors"
                title="Settings"
              >
                ⚙️
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <p>No projects yet</p>
            <p className="text-sm mt-1">Click + to add a project</p>
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="border-b border-gray-700">
              {/* Project Header */}
              <div
                className="flex items-center justify-between p-3 hover:bg-gray-700 cursor-pointer"
                onClick={() => toggleProject(project.id)}
              >
                <div className="flex items-center flex-1 min-w-0">
                  <span className="mr-2">
                    {expandedProjects.has(project.id) ? '▼' : '▶'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{project.name}</div>
                    <div className="text-xs text-gray-400 truncate">{project.path}</div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateSession(project.id)
                  }}
                  className="ml-2 px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
                  title="New Session"
                >
                  +
                </button>
              </div>

              {/* Sessions List */}
              {expandedProjects.has(project.id) && (
                <div className="bg-gray-750">
                  {project.sessions.length === 0 ? (
                    <div className="p-3 pl-8 text-sm text-gray-400">
                      No sessions yet
                    </div>
                  ) : (
                    project.sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`flex items-center justify-between p-3 pl-8 hover:bg-gray-600 cursor-pointer ${
                          activeSessionId === session.id ? 'bg-blue-600' : ''
                        }`}
                        onClick={() => onActivateSession(session.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-medium truncate">{session.name}</div>
                            {session.claudeSessionId && (
                              <span className="text-xs bg-green-600 text-white px-1 rounded">Claude</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDate(session.lastActiveAt)}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Delete this session?')) {
                              onDeleteSession(session.id)
                            }
                          }}
                          className="ml-2 px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
                          title="Delete Session"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default SessionList