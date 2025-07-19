import React from 'react'
import { useAppStore } from '../stores/appStore'

const StatusBar: React.FC = () => {
  const {
    isClaudeCodeRunning,
    terminalConnected,
    currentStats,
    settings,
    stopClaudeCode,
    startClaudeCode,
    activeProjectId,
    projects,
    setSettingsOpen,
    claudeDetection,
    detectClaude
  } = useAppStore()

  const activeProvider = settings.apiProviders.find(p => p.id === settings.activeModelId)
  const activeProject = projects.find(p => p.id === activeProjectId)

  const getStatusInfo = () => {
    if (!terminalConnected) {
      return { color: 'text-gray-400', bgColor: 'bg-gray-400', text: 'Disconnected', animate: false }
    }
    if (isClaudeCodeRunning) {
      return { color: 'text-green-400', bgColor: 'bg-green-500', text: 'Connected', animate: false }
    }
    return { color: 'text-yellow-400', bgColor: 'bg-yellow-500', text: 'Ready', animate: false }
  }

  const status = getStatusInfo()

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
    // This will be connected via a ref from parent component
    if (window.terminalRef?.current) {
      window.terminalRef.current.clear()
    }
  }

  // 处理路径显示，确保最后的路径部分完整显示
  const formatPath = (path: string) => {
    const segments = path.split('/')
    if (segments.length <= 2) return path
    
    // 保留最后两个路径段
    const lastTwo = segments.slice(-2).join('/')
    const prefix = segments.slice(0, -2).join('/')
    
    return prefix.length > 0 ? `.../${lastTwo}` : lastTwo
  }

  // 获取 Claude 安装状态信息
  const getClaudeStatusInfo = () => {
    if (!claudeDetection) {
      return { color: 'text-gray-400', icon: '⚪', text: 'Checking...', tooltip: 'Checking Claude installation...' }
    }
    
    if (claudeDetection.error) {
      return { 
        color: 'text-red-400', 
        icon: '❌', 
        text: 'Error', 
        tooltip: `Detection error: ${claudeDetection.error}` 
      }
    }
    
    if (!claudeDetection.isInstalled) {
      return { 
        color: 'text-yellow-400', 
        icon: '⚠️', 
        text: 'Not Installed', 
        tooltip: 'Claude CLI not detected. .claude directory not found.' 
      }
    }
    
    const validInstalls = claudeDetection.installations.filter(i => i.valid)
    if (validInstalls.length === 0) {
      return { 
        color: 'text-orange-400', 
        icon: '⚠️', 
        text: 'Invalid', 
        tooltip: 'Claude CLI detected but no valid installations found' 
      }
    }
    
    const install = validInstalls[0]
    return { 
      color: 'text-green-400', 
      icon: '✅', 
      text: install.version || 'Installed', 
      tooltip: `Claude CLI installed: ${install.path}${install.version ? ` (v${install.version})` : ''}` 
    }
  }

  const claudeStatus = getClaudeStatusInfo()

  return (
    <footer className="fixed bottom-0 left-0 right-0 flex items-center h-8 px-3 bg-gray-900 border-t border-gray-700 text-xs text-gray-300 z-50">
      <div className="flex items-center space-x-4 flex-1">
        {/* Connection Status */}
        <div className="flex items-center space-x-1">
          <div className={`w-1.5 h-1.5 ${status.bgColor} rounded-full`}></div>
          <span>{status.text}</span>
        </div>
        
        {/* Claude Installation Status */}
        <div 
          className={`flex items-center space-x-1 ${claudeStatus.color} cursor-pointer hover:opacity-80`}
          title={claudeStatus.tooltip}
          onClick={() => detectClaude()}
        >
          <span>{claudeStatus.icon}</span>
          <span>Claude: {claudeStatus.text}</span>
        </div>
        
        {/* API Provider */}
        <div className="flex items-center space-x-1">
          <span>Model:</span>
          <span className="text-green-400">{activeProvider?.name || 'Anthropic Claude'}</span>
        </div>
        
        {/* Project Path */}
        {activeProject && (
          <div className="flex items-center space-x-1 text-gray-400">
            <span>{formatPath(activeProject.path)}</span>
          </div>
        )}
      </div>
      
      {/* Right side - Settings */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center space-x-1 hover:text-white transition-colors"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </footer>
  )
}

export default StatusBar