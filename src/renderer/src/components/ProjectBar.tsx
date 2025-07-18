import React, { useState } from 'react'
import { useAppStore } from '../stores/appStore'

const ProjectBar: React.FC = () => {
  const {
    projects,
    activeProjectId,
    setActiveProject,
    setSettingsOpen,
    createProject,
    selectProjectDirectory,
    getProjectHistory,
    extractProjectName
  } = useAppStore()
  
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [selectedPath, setSelectedPath] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [projectHistory, setProjectHistory] = useState<string[]>([])

  const handleSelectDirectory = async () => {
    try {
      const path = await selectProjectDirectory()
      if (path) {
        setSelectedPath(path)
        const name = await extractProjectName(path)
        setNewProjectName(name)
      }
    } catch (error) {
      console.error('Failed to select directory:', error)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !selectedPath) return
    
    try {
      await createProject(newProjectName.trim(), selectedPath)
      setNewProjectName('')
      setSelectedPath('')
      setIsCreatingProject(false)
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  const handleCreateFromHistory = async (path: string) => {
    try {
      const name = await extractProjectName(path)
      await createProject(name, path)
      setShowHistory(false)
    } catch (error) {
      console.error('Failed to create project from history:', error)
    }
  }

  const handleShowHistory = async () => {
    try {
      const history = await getProjectHistory()
      setProjectHistory(history)
      setShowHistory(true)
    } catch (error) {
      console.error('Failed to load project history:', error)
    }
  }

  const resetCreateProjectState = () => {
    setIsCreatingProject(false)
    setNewProjectName('')
    setSelectedPath('')
    setShowHistory(false)
  }

  const getProjectInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2)
  }

  const getProjectColor = (id: string, isActive: boolean) => {
    if (isActive) return 'bg-blue-600 text-white ring-2 ring-white'
    
    // Generate consistent colors based on project ID
    const colors = [
      'bg-purple-600 text-white',
      'bg-green-600 text-white',
      'bg-red-600 text-white',
      'bg-yellow-600 text-white',
      'bg-indigo-600 text-white',
      'bg-pink-600 text-white'
    ]
    const colorIndex = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
    return colors[colorIndex]
  }

  return (
    <nav className="w-16 bg-gray-900 flex-shrink-0 flex flex-col items-center py-4 gap-4 border-r border-gray-700">
      {/* Project Icons */}
      {projects.map((project) => (
        <div
          key={project.id}
          className={`project-icon w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm cursor-pointer transition-all hover:scale-105 ${getProjectColor(project.id, project.id === activeProjectId)}`}
          title={`Project '${project.name}'`}
          onClick={() => {
            setActiveProject(project.id).catch(console.error)
          }}
        >
          {getProjectInitials(project.name)}
        </div>
      ))}
      
      {/* Add New Project Button */}
      {isCreatingProject ? (
        <div className="flex flex-col items-center gap-2 p-3 bg-gray-800 rounded-lg max-w-48 relative">
          {showHistory ? (
            <div className="w-full">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-300">Recent Projects</span>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {projectHistory.map((path, index) => (
                  <div
                    key={index}
                    onClick={() => handleCreateFromHistory(path)}
                    className="cursor-pointer hover:bg-gray-700 p-2 rounded text-xs text-gray-300 truncate"
                    title={path}
                  >
                    {path.split('/').pop()}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-1 mb-2">
                <button
                  onClick={handleSelectDirectory}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  title="Select Directory"
                >
                  📁
                </button>
                <button
                  onClick={handleShowHistory}
                  className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                  title="Recent Projects"
                >
                  📋
                </button>
              </div>
              
              {selectedPath && (
                <div className="text-xs text-gray-400 mb-2 truncate max-w-full" title={selectedPath}>
                  {selectedPath.split('/').pop()}
                </div>
              )}
              
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name"
                className="w-full px-2 py-1 text-xs bg-gray-700 text-white rounded border-none outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject()
                  if (e.key === 'Escape') resetCreateProjectState()
                }}
              />
              
              <div className="flex gap-1 mt-2">
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || !selectedPath}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  ✓
                </button>
                <button
                  onClick={resetCreateProjectState}
                  className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  ✕
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          title="Add New Project"
          onClick={() => setIsCreatingProject(true)}
          className="project-icon bg-gray-800 hover:bg-gray-700 text-gray-400 w-10 h-10 rounded-full flex items-center justify-center border-2 border-dashed border-gray-600 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
      
      <div className="w-8 border-t border-gray-700 my-2"></div>
      
      {/* All Sessions View */}
      <button
        title="All Sessions"
        onClick={() => {
          setActiveProject(null).catch(console.error)
        }}
        className={`project-icon w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          activeProjectId === null 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {/* Settings Button */}
      <button
        title="Settings"
        onClick={() => setSettingsOpen(true)}
        className="mt-auto project-icon bg-gray-700 hover:bg-gray-600 text-gray-300 w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </nav>
  )
}

export default ProjectBar