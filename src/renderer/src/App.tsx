import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import MainContent from './components/MainContent'
import SettingsModal from './components/SettingsModal'
import ErrorBoundary from './components/ErrorBoundary'
import LoadingSpinner from './components/LoadingSpinner'
import StatusBar from './components/StatusBar'
import { ClaudeInstallationGuide } from './components/ClaudeInstallationGuide'
import { initializeStore, useAppStore } from './stores/appStore'
import { logger } from './utils/logger'

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [showInstallationGuide, setShowInstallationGuide] = useState(false)
  
  // Use Claude detection from store
  const { claudeDetection, detectClaude } = useAppStore()

  useEffect(() => {
    // Initialize store data and detect Claude Code when app starts
    const initializeApp = async () => {
      try {
        logger.info('App initializing...')
        // Initialize store (this includes Claude detection)
        await initializeStore()
        logger.info('App initialized successfully')
        
        setIsInitializing(false)
      } catch (error) {
        logger.error('Failed to initialize app', error)
        setInitError(error.message || 'Failed to initialize application')
        setIsInitializing(false)
      }
    }
    
    initializeApp()

    // Add keyboard shortcuts
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + , for settings
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault()
        logger.debug('Settings shortcut pressed')
        // This would open settings modal
      }
      
      // Ctrl/Cmd + N for new session
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault()
        logger.debug('New session shortcut pressed')
      }

      // Ctrl/Cmd + K for clear terminal
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        if ((window as any).terminalRef?.current) {
          (window as any).terminalRef.current.clear()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Watch for Claude detection changes and show installation guide if needed
  useEffect(() => {
    if (claudeDetection && !claudeDetection.isInstalled) {
      setShowInstallationGuide(true)
    }
  }, [claudeDetection])

  const handleClaudeRecheck = async () => {
    try {
      // Clear cache and re-detect using store
      await window.api.clearClaudeCache()
      await detectClaude()
      
      // Hide installation guide if Claude Code is now detected
      if (claudeDetection?.isInstalled) {
        setShowInstallationGuide(false)
      }
    } catch (error) {
      console.error('Failed to recheck Claude Code:', error)
    }
  }

  if (isInitializing) {
    return (
      <div className="flex h-screen bg-claude-bg text-claude-text-primary">
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner 
            size="lg" 
            text="Initializing CC Copilot..." 
          />
        </div>
      </div>
    )
  }

  if (initError) {
    return (
      <div className="flex h-screen bg-claude-bg text-claude-text-primary">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-400 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-red-400 mb-2">Initialization Failed</h2>
            <p className="text-claude-text-secondary mb-4">{initError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-claude-accent hover:bg-opacity-80 text-white font-medium rounded-md transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-claude-bg text-claude-text-primary font-inter antialiased">
        {/* Main Content Area - Reserve space for status bar */}
        <div className="flex" style={{ height: 'calc(100vh - 32px)' }}>
          {/* Session List Sidebar */}
          <ErrorBoundary fallback={
            <div className="w-72 bg-claude-sidebar flex items-center justify-center">
              <div className="text-red-400 text-sm">Sidebar error</div>
            </div>
          }>
            <Sidebar />
          </ErrorBoundary>
          
          {/* Main Content Area */}
          <ErrorBoundary>
            <MainContent />
          </ErrorBoundary>
        </div>
        
        {/* Status Bar - Fixed at bottom */}
        <ErrorBoundary>
          <StatusBar />
        </ErrorBoundary>
        
        {/* Settings Modal (Hidden by default) */}
        <ErrorBoundary>
          <SettingsModal />
        </ErrorBoundary>
        
        {/* Claude Installation Guide */}
        {showInstallationGuide && (
          <ClaudeInstallationGuide
            onClose={() => setShowInstallationGuide(false)}
            onRecheck={handleClaudeRecheck}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App