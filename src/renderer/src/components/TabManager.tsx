import React, { useState, useRef, useEffect } from 'react'
import Terminal, { TerminalRef } from './Terminal'
import { useAppStore } from '../stores/appStore'

interface Tab {
  id: string
  sessionId: string
  sessionName: string
  projectName: string
  terminalRef: React.RefObject<TerminalRef>
  isActive: boolean
}

const TabManager: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const tabsContainerRef = useRef<HTMLDivElement>(null)
  
  const { 
    claudeProjects,
    activeClaudeSessionId,
    activeClaudeProjectId,
    setActiveClaudeSession,
    setActiveClaudeProject
  } = useAppStore()

  // Create or switch to tab when active Claude session changes
  useEffect(() => {
    if (activeClaudeSessionId) {
      // Check if tab already exists
      const existingTab = tabs.find(t => t.sessionId === activeClaudeSessionId)
      
      if (existingTab) {
        // Switch to existing tab
        setActiveTabId(existingTab.id)
        return
      }
      
      // Find the session and project for the active Claude session
      let session = null
      let project = null
      
      for (const proj of claudeProjects) {
        const foundSession = proj.sessions.find(s => s.id === activeClaudeSessionId)
        if (foundSession) {
          session = foundSession
          project = proj
          break
        }
      }
      
      // Create new tab - either with found session/project or as temporary tab
      const newTab: Tab = {
        id: `tab-${Date.now()}`,
        sessionId: activeClaudeSessionId,
        sessionName: session ? session.name : `New Session`,
        projectName: project ? project.name : 'Unknown Project',
        terminalRef: React.createRef<TerminalRef>(),
        isActive: true
      }
      
      setTabs(prev => {
        const updated = prev.map(t => ({ ...t, isActive: false }))
        return [...updated, newTab]
      })
      setActiveTabId(newTab.id)
    }
  }, [activeClaudeSessionId, claudeProjects, tabs])

  // Update active state when activeTabId changes
  useEffect(() => {
    setTabs(prev => prev.map(tab => ({
      ...tab,
      isActive: tab.id === activeTabId
    })))
  }, [activeTabId])

  // Update tab information when claudeProjects changes (refresh session names)
  useEffect(() => {
    setTabs(prev => prev.map(tab => {
      // Find updated session information
      for (const proj of claudeProjects) {
        const foundSession = proj.sessions.find(s => s.id === tab.sessionId)
        if (foundSession) {
          return {
            ...tab,
            sessionName: foundSession.name,
            projectName: proj.name
          }
        }
      }
      return tab
    }))
  }, [claudeProjects])

  const handleTabClick = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (tab) {
      setActiveTabId(tabId)
      setActiveClaudeSession(tab.sessionId)
    }
  }

  const handleTabClose = (tabId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    
    setTabs(prev => {
      const updated = prev.filter(t => t.id !== tabId)
      
      // If closing active tab, switch to another tab
      if (tabId === activeTabId) {
        const remainingTabs = updated
        if (remainingTabs.length > 0) {
          const nextTab = remainingTabs[remainingTabs.length - 1]
          setActiveTabId(nextTab.id)
          setActiveClaudeSession(nextTab.sessionId)
        } else {
          setActiveTabId(null)
          setActiveClaudeSession(null)
        }
      }
      
      return updated
    })
  }

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = 200
      const currentScroll = tabsContainerRef.current.scrollLeft
      const newScroll = direction === 'left' 
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount
      
      tabsContainerRef.current.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      })
    }
  }

  if (tabs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-claude-text-secondary">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium mb-2">No Session Selected</h3>
          <p className="text-sm">Select or create a session to start coding</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar with Horizontal Scrolling */}
      <div className="flex-shrink-0 relative">
        <div 
          ref={tabsContainerRef}
          className="flex items-center overflow-x-auto scrollbar-hide border-b border-claude-border whitespace-nowrap"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab.isActive 
                  ? 'text-white border-claude-accent' 
                  : 'text-claude-text-secondary hover:bg-claude-border/40 border-transparent'
              }`}
            >
              <span className="truncate">{tab.sessionName}</span>
              <button
                onClick={(e) => handleTabClose(tab.id, e)}
                className="text-claude-text-secondary hover:text-white transition-colors"
                title="Close tab"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </button>
          ))}
        </div>
        {/* Fade-out effect to indicate more tabs */}
        <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-claude-bg to-transparent pointer-events-none"></div>
      </div>

      {/* Terminal Area */}
      <div className="flex-1 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${tab.isActive ? 'block' : 'hidden'}`}
          >
            <Terminal ref={tab.terminalRef} sessionId={tab.sessionId} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default TabManager