import React, { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'

const SessionList: React.FC = () => {
  const {
    projects,
    sessions,
    activeProjectId,
    activeSessionId,
    setActiveSession,
    createSession,
    deleteSession,
    loadSessions
  } = useAppStore()
  
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')

  const activeProject = projects.find(p => p.id === activeProjectId)
  const currentSessions = activeProjectId ? sessions : []

  useEffect(() => {
    if (activeProjectId) {
      loadSessions(activeProjectId)
    }
  }, [activeProjectId, loadSessions])

  const handleCreateSession = async () => {
    if (!newSessionName.trim() || !activeProjectId) return
    
    try {
      await createSession(activeProjectId, newSessionName.trim())
      setNewSessionName('')
      setIsCreatingSession(false)
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

  return (
    <aside className="w-64 flex-shrink-0 bg-gray-800 flex flex-col p-4 border-r border-gray-700">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white mb-1">
          {activeProject ? `Project '${activeProject.name}'` : 'All Sessions'}
        </h1>
        <p className="text-xs text-gray-400">
          {activeProject 
            ? `${currentSessions.length} session${currentSessions.length !== 1 ? 's' : ''} in this project`
            : 'Select a project to view sessions'
          }
        </p>
      </div>
      
      {/* New Chat Button - only show if a project is selected */}
      {activeProject && (
        isCreatingSession ? (
          <div className="mb-4 p-3 bg-gray-700 rounded-md">
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="Session name..."
              className="w-full px-3 py-2 text-sm bg-gray-600 text-white rounded border-none outline-none mb-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSession()
                if (e.key === 'Escape') {
                  setIsCreatingSession(false)
                  setNewSessionName('')
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateSession}
                className="flex-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreatingSession(false)
                  setNewSessionName('')
                }}
                className="flex-1 px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setIsCreatingSession(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors mb-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Chat
          </button>
        )
      )}
      
      {/* Sessions List */}
      <div className="flex-grow overflow-y-auto pr-2 -mr-2">
        {!activeProject ? (
          <div className="text-center text-gray-400 mt-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.013 8.013 0 01-7.93-7M3 12a9 9 0 1118 0z" />
            </svg>
            <p className="text-sm">Select a project to view sessions</p>
          </div>
        ) : currentSessions.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.013 8.013 0 01-7.93-7M3 12a9 9 0 1118 0z" />
            </svg>
            <p className="text-sm">No sessions yet</p>
            <p className="text-xs mt-1">Create your first chat session</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {currentSessions.map((session) => (
              <li
                key={session.id}
                className={`group relative p-3 rounded-md cursor-pointer transition-colors ${
                  session.id === activeSessionId
                    ? 'bg-blue-900/50 text-white'
                    : 'hover:bg-gray-700 text-gray-300'
                }`}
                onClick={() => setActiveSession(session.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">{session.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(session.createdAt)}
                    </p>
                    {session.history.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {session.history.length} message{session.history.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-red-400 transition-all"
                    title="Delete session"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

export default SessionList