import React, { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import EnvManager from './EnvManager'

const Toolbar: React.FC = () => {
  const {
    activeProjectId,
    projects,
    createSession,
    startClaudeCode,
    selectProjectDirectory,
    extractProjectName,
    createProject
  } = useAppStore()

  const [showEnvManager, setShowEnvManager] = useState(false)

  const handleOpenProject = async () => {
    try {
      const path = await selectProjectDirectory()
      if (path) {
        const name = await extractProjectName(path)
        await createProject(name, path)
      }
    } catch (error) {
      console.error('Failed to open project:', error)
    }
  }

  const handleCreateSession = async () => {
    if (!activeProjectId) return

    try {
      // 创建会话（自动生成名称）
      const session = await createSession(activeProjectId)
      
      // 启动claude-code子进程
      await startClaudeCode()
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
      <div className="flex items-center gap-4">
        {/* Logo/Title */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">CC</span>
          </div>
          <h1 className="text-lg font-bold text-white">CC Copilot</h1>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <span>Dashboard</span>
          <span className="text-gray-600">/</span>
          <span className="text-white">Projects</span>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {/* New Session */}
        {activeProjectId && (
          <button
            onClick={handleCreateSession}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Session
          </button>
        )}

        {/* Open Project */}
        <button
          onClick={handleOpenProject}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-3-3v6" />
          </svg>
          Open Project
        </button>

        {/* Environment Variables */}
        <button
          onClick={() => setShowEnvManager(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors font-medium"
          title="Environment Variables"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          ENV
        </button>

        {/* Project Info */}
        {activeProjectId && projects && (
          <div className="flex items-center gap-2 ml-4 text-sm text-gray-400">
            <span>Active:</span>
            <span className="text-white font-medium">{projects.find(p => p.id === activeProjectId)?.name || 'Loading...'}</span>
          </div>
        )}
      </div>

      <EnvManager 
        isOpen={showEnvManager} 
        onClose={() => setShowEnvManager(false)} 
      />
    </div>
  )
}

export default Toolbar