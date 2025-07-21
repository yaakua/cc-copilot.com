import React, { useState, useEffect, useRef } from 'react'
import Terminal from './Terminal'
import { Session, Project } from '../../../shared/types'

interface TabInfo {
  sessionId: string
  session: Session
  isActive: boolean
}

interface TabManagerProps {
  projects: Project[]
  activeSessionIds: string[]
  currentActiveSessionId: string | null
  onActivateSession: (sessionId: string) => void
  onCloseTab: (sessionId: string) => void
}

const TabManager: React.FC<TabManagerProps> = ({
  projects,
  activeSessionIds,
  currentActiveSessionId,
  onActivateSession,
  onCloseTab
}) => {
  const [tabs, setTabs] = useState<TabInfo[]>([])
  const tabsContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const newTabs: TabInfo[] = []
    
    for (const sessionId of activeSessionIds) {
      let session: Session | undefined
      
      // Find session in projects
      for (const project of projects) {
        session = project.sessions.find(s => s.id === sessionId)
        if (session) break
      }
      
      if (session) {
        newTabs.push({
          sessionId,
          session,
          isActive: sessionId === currentActiveSessionId
        })
      }
    }
    
    setTabs(newTabs)
  }, [activeSessionIds, currentActiveSessionId, projects])

  const handleTabClick = (sessionId: string) => {
    onActivateSession(sessionId)
  }

  const handleCloseTab = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    onCloseTab(sessionId)
  }

  const getSessionDisplayName = (session: Session) => {
    const project = projects.find(p => p.id === session.projectId)
    const projectName = project?.name || 'Unknown'
    return `${projectName} - ${session.name}`
  }

  const scrollTabsLeft = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' })
    }
  }

  const scrollTabsRight = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' })
    }
  }

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
        <div className="text-center">
          <h2 className="text-xl mb-2">No Active Sessions</h2>
          <p>Select a session from the sidebar or create a new project</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 flex flex-col min-h-0">
        {/* Tab Bar */}
        <div className="flex-shrink-0">
          <div className="flex items-end" style={{ borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-sidebar)' }}>
            {tabs.map((tab, index) => (
              <div
                key={tab.sessionId}
                onClick={() => handleTabClick(tab.sessionId)}
                className={`flex items-center gap-2 px-4 py-2.5 border-b-2 cursor-pointer transition-colors ${
                  tab.isActive ? 'tab-item-active' : ''
                }`}
                style={{
                  backgroundColor: tab.isActive ? 'var(--bg-primary)' : 'transparent',
                  color: tab.isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderBottomColor: tab.isActive ? 'var(--accent)' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (!tab.isActive) {
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!tab.isActive) {
                    e.currentTarget.style.color = 'var(--text-tertiary)'
                  }
                }}
              >
                <span className="terminal-font text-sm truncate max-w-[200px]">
                  {getSessionDisplayName(tab.session)}
                </span>
                <button
                  onClick={(e) => handleCloseTab(e, tab.sessionId)}
                  className="ml-1 opacity-0 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                  title="Close tab"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Terminal Content */}
        <div className="flex-grow p-4 terminal-font overflow-y-auto" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
          {tabs.map((tab) => (
            <div
              key={tab.sessionId}
              className={`h-full w-full ${tab.isActive ? 'block' : 'hidden'}`}
            >
              <Terminal sessionId={tab.sessionId} isActive={tab.isActive} session={tab.session} />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default TabManager