import React from 'react'
import { useAppStore } from '../stores/appStore'

const StatusBar: React.FC = () => {
  const {
    isClaudeCodeRunning,
    terminalConnected,
    currentStats,
    settings,
    stopClaudeCode,
    startClaudeCode
  } = useAppStore()

  const activeProvider = settings.apiProviders.find(p => p.id === settings.activeModelId)

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

  return (
    <footer className="flex-shrink-0 flex items-center justify-between h-8 px-4 bg-claude-sidebar border-t border-claude-border text-xs">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1.5 text-green-400">
          <div className={`w-2 h-2 ${status.bgColor} rounded-full`}></div>
          <span>{status.text}</span>
        </div>
        <div className="relative group">
          <button className="flex items-center space-x-2 text-claude-text-secondary hover:bg-claude-border/40 px-2 py-0.5 rounded-md transition-colors">
            <span>接口渠道: <span className="text-claude-accent font-semibold">{activeProvider?.name || 'Anthropic Claude'}</span></span>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {/* Dropdown Menu */}
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-claude-sidebar border border-claude-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            <div className="py-1">
              {settings.apiProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => {
                    // TODO: 实现渠道切换功能
                    console.log('Switch to provider:', provider.name)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-claude-border/40 flex items-center justify-between ${
                    provider.id === settings.activeModelId 
                      ? 'bg-claude-border/20 text-claude-text-primary' 
                      : 'text-claude-text-secondary'
                  }`}
                >
                  <span>{provider.name}</span>
                  {provider.id === settings.activeModelId && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default StatusBar