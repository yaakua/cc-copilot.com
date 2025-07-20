import React, { useState, useEffect } from 'react'
import { logger } from '../utils/logger'

interface StatusBarProps {
  activeSessionId: string | null
}

interface StatusInfo {
  sessionId: string | null
  projectPath: string
  provider: string
  proxy: string
}

const StatusBar: React.FC<StatusBarProps> = ({ activeSessionId }) => {
  const [statusInfo, setStatusInfo] = useState<StatusInfo | null>(null)

  useEffect(() => {
    logger.setComponent('StatusBar')
    const loadStatus = async () => {
      if (!activeSessionId) {
        setStatusInfo(null)
        return
      }

      try {
        const status = await window.api.getCurrentStatus()
        setStatusInfo(status)
      } catch (error) {
        logger.error('Failed to load status', error as Error)
      }
    }

    loadStatus()
    // Update status periodically
    const interval = setInterval(loadStatus, 5000)
    return () => clearInterval(interval)
  }, [activeSessionId])

  const formatPath = (path: string) => {
    if (!path) return ''
    const segments = path.split('/')
    if (segments.length <= 2) return path
    
    const lastTwo = segments.slice(-2).join('/')
    return `.../${lastTwo}`
  }

  return (
    <div className="h-8 bg-gray-800 border-t border-gray-700 flex items-center px-4 text-xs text-gray-400">
      <div className="flex items-center space-x-6 flex-1">
        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${activeSessionId ? 'bg-green-500' : 'bg-gray-500'}`}></div>
          <span>{activeSessionId ? 'Connected' : 'No Active Session'}</span>
        </div>
        
        {/* Current Session Info */}
        {statusInfo && (
          <>
            {/* Provider */}
            <div className="flex items-center space-x-1">
              <span>Provider:</span>
              <span className="text-green-400">{statusInfo.provider}</span>
            </div>
            
            {/* Proxy Status */}
            <div className="flex items-center space-x-1">
              <span>Proxy:</span>
              <span className="text-blue-400">{statusInfo.proxy}</span>
            </div>
            
            {/* Project Path */}
            {statusInfo.projectPath && (
              <div className="flex items-center space-x-1">
                <span>Project:</span>
                <span className="text-yellow-400">{formatPath(statusInfo.projectPath)}</span>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Right side info */}
      <div className="text-xs text-gray-500">
        CC Copilot v1.0.0
      </div>
    </div>
  )
}

export default StatusBar