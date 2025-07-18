import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Toolbar from './components/Toolbar'
import MainContent from './components/MainContent'
import SettingsModal from './components/SettingsModal'
import ErrorBoundary from './components/ErrorBoundary'
import LoadingSpinner from './components/LoadingSpinner'
import { initializeStore } from './stores/appStore'

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    // Initialize store data when app starts
    initializeStore()
      .then(() => {
        setIsInitializing(false)
      })
      .catch((error) => {
        console.error('Failed to initialize app:', error)
        setInitError(error.message || 'Failed to initialize application')
        setIsInitializing(false)
      })

    // Add keyboard shortcuts
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + , for settings
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault()
        // This would open settings modal
        console.log('Settings shortcut pressed')
      }
      
      // Ctrl/Cmd + N for new session
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault()
        console.log('New session shortcut pressed')
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

  if (isInitializing) {
    return (
      <div className="flex h-screen bg-gray-900 text-gray-300">
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
      <div className="flex h-screen bg-gray-900 text-gray-300">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-400 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-red-400 mb-2">Initialization Failed</h2>
            <p className="text-gray-400 mb-4">{initError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
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
      <div className="flex h-screen bg-gray-900 text-gray-300 font-sans antialiased flex-col">
        {/* Top Toolbar */}
        <ErrorBoundary fallback={
          <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-center">
            <div className="text-red-400 text-sm">Toolbar error</div>
          </div>
        }>
          <Toolbar />
        </ErrorBoundary>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar with Projects and Sessions */}
          <ErrorBoundary fallback={
            <div className="w-80 bg-gray-800 border-r border-gray-700 flex items-center justify-center">
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
        
        {/* Settings Modal (Hidden by default) */}
        <ErrorBoundary>
          <SettingsModal />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  )
}

export default App