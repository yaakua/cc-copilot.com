import React from 'react'
import { useAppStore } from '../stores/appStore'

const StatusBar: React.FC = () => {
  const {
    isClaudeCodeRunning,
    terminalConnected,
    currentStats,
    statsScope,
    setStatsScope,
    activeProjectId,
    activeSessionId,
    projects,
    stopClaudeCode,
    startClaudeCode
  } = useAppStore()

  const activeProject = projects.find(p => p.id === activeProjectId)

  const getStatusInfo = () => {
    if (!terminalConnected) {
      return { color: 'text-gray-400', bgColor: 'bg-gray-400', text: 'Disconnected', animate: false }
    }
    if (isClaudeCodeRunning) {
      return { color: 'text-green-400', bgColor: 'bg-green-500', text: 'Running', animate: true }
    }
    return { color: 'text-yellow-400', bgColor: 'bg-yellow-500', text: 'Ready', animate: false }
  }

  const status = getStatusInfo()

  const getScopeDisplayName = () => {
    switch (statsScope) {
      case 'session':
        return 'Current Session'
      case 'project':
        return activeProject ? `Project '${activeProject.name}'` : 'Project'
      case 'global':
        return 'Global'
      default:
        return 'Current Session'
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const handleStopClaudeCode = async () => {
    try {
      await stopClaudeCode()
    } catch (error) {
      console.error('Failed to stop claude-code:', error)
    }
  }

  const handleStartClaudeCode = async () => {
    try {
      await startClaudeCode()
    } catch (error) {
      console.error('Failed to start claude-code:', error)
    }
  }

  const handleClearTerminal = () => {
    // TODO: Implement terminal clear functionality
    console.log('Clear terminal requested')
  }

  return (
    <div className="flex-shrink-0 h-20 bg-gray-800 border-t border-gray-700 px-6 flex items-center justify-between">
      {/* Left: Status */}
      <div className="flex items-center gap-3">
        <span className={`w-3 h-3 ${status.bgColor} rounded-full ${status.animate ? 'animate-pulse' : ''}`}></span>
        <span className={`font-medium ${status.color}`}>{status.text}</span>
      </div>

      {/* Center: Usage Stats with Scope Selector */}
      <div className="flex items-center gap-8">
        {/* Scope Selector */}
        <div className="relative group">
          <button className="text-xs uppercase font-bold text-gray-400 hover:text-white flex items-center gap-1">
            {getScopeDisplayName()}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="absolute bottom-full mb-2 w-48 bg-gray-700 rounded-md shadow-lg hidden group-hover:block z-10">
            {activeSessionId && (
              <button
                onClick={() => setStatsScope('session')}
                className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-600 ${
                  statsScope === 'session' ? 'text-white bg-gray-800' : 'text-gray-300'
                }`}
              >
                Current Session
              </button>
            )}
            {activeProjectId && (
              <button
                onClick={() => setStatsScope('project')}
                className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-600 ${
                  statsScope === 'project' ? 'text-white bg-gray-800' : 'text-gray-300'
                }`}
              >
                {activeProject ? `Project '${activeProject.name}'` : 'Current Project'}
              </button>
            )}
            <button
              onClick={() => setStatsScope('global')}
              className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-600 ${
                statsScope === 'global' ? 'text-white bg-gray-800' : 'text-gray-300'
              }`}
            >
              Global
            </button>
          </div>
        </div>
        
        {/* Stats Display */}
        <div className="text-center">
          <div className="text-xl font-semibold text-cyan-400">{formatNumber(currentStats.prompt)}</div>
          <div className="text-xs text-gray-400">PROMPT</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-cyan-400">{formatNumber(currentStats.completion)}</div>
          <div className="text-xs text-gray-400">COMPLETION</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-cyan-400">{formatNumber(currentStats.total)}</div>
          <div className="text-xs text-gray-400">TOTAL</div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {isClaudeCodeRunning ? (
          <button 
            onClick={handleStopClaudeCode}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            Stop
          </button>
        ) : (
          <button 
            onClick={handleStartClaudeCode}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            Start
          </button>
        )}
        <button 
          onClick={handleClearTerminal}
          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

export default StatusBar