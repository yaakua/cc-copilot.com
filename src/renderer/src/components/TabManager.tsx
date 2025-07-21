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
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <h2 className="text-xl mb-2">No Active Sessions</h2>
          <p>Select a session from the sidebar or create a new project</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Tab Bar */}
      <div className="flex items-center bg-gray-800 border-b border-gray-700">
        {tabs.length > 5 && (
          <button
            onClick={scrollTabsLeft}
            className="px-2 py-2 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Scroll left"
          >
            ‹
          </button>
        )}
        
        <div 
          ref={tabsContainerRef}
          className="flex-1 flex overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Hide scrollbar for Webkit browsers */}
          <style>{`
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          
          {tabs.map((tab) => (
            <div
              key={tab.sessionId}
              onClick={() => handleTabClick(tab.sessionId)}
              className={`flex items-center px-4 py-2 border-r border-gray-700 cursor-pointer min-w-0 flex-shrink-0 max-w-[200px] group transition-colors ${
                tab.isActive 
                  ? 'bg-gray-700 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center min-w-0 flex-1">
                <div className="truncate text-sm">
                  {getSessionDisplayName(tab.session)}
                </div>
                <button
                  onClick={(e) => handleCloseTab(e, tab.sessionId)}
                  className="ml-2 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Close tab"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {tabs.length > 5 && (
          <button
            onClick={scrollTabsRight}
            className="px-2 py-2 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Scroll right"
          >
            ›
          </button>
        )}
      </div>

      {/* Terminal Content */}
      <div className="flex-1 relative bg-black">
        {tabs.map((tab) => (
          <div
            key={tab.sessionId}
            className={`absolute inset-0 h-full w-full ${tab.isActive ? 'block' : 'hidden'}`}
          >
            <Terminal sessionId={tab.sessionId} isActive={tab.isActive} session={tab.session} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default TabManager