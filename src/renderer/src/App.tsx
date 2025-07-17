import React, { useEffect } from 'react'
import ProjectBar from './components/ProjectBar'
import SessionList from './components/SessionList'
import MainContent from './components/MainContent'
import SettingsModal from './components/SettingsModal'
import { initializeStore } from './stores/appStore'

const App: React.FC = () => {
  useEffect(() => {
    // Initialize store data when app starts
    initializeStore().catch(console.error)
  }, [])

  return (
    <div className="flex h-screen bg-gray-900 text-gray-300 font-sans antialiased">
      {/* Project Bar (Left Sidebar) */}
      <ProjectBar />
      
      {/* Session List */}
      <SessionList />
      
      {/* Main Content Area */}
      <MainContent />
      
      {/* Settings Modal (Hidden by default) */}
      <SettingsModal />
    </div>
  )
}

export default App