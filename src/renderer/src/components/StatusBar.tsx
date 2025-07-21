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
        logger.error('加载状态失败', error as Error)
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
    <footer className="flex items-center justify-between px-4 py-1 text-sm shrink-0" style={{ backgroundColor: 'var(--bg-sidebar)', borderTop: '1px solid var(--border-primary)' }}>
      <div className="flex items-center gap-4" style={{ color: 'var(--text-tertiary)' }}>
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div 
            className="status-dot" 
            style={{ backgroundColor: activeSessionId ? 'var(--status-green)' : 'var(--text-tertiary)' }}
          ></div>
          <span>{activeSessionId ? 'Connected' : 'Disconnected'}</span>
        </div>
        
        {/* Provider Info */}
        {statusInfo && statusInfo.provider && (
          <span>Provider: {statusInfo.provider}</span>
        )}
        
        {/* Proxy Info */}
        {statusInfo && statusInfo.proxy && statusInfo.proxy !== 'None' && (
          <span>Proxy: {statusInfo.proxy}</span>
        )}
      </div>
      
      {/* Right side - Git/Project info */}
      <div style={{ color: 'var(--text-tertiary)' }}>
        {statusInfo && statusInfo.projectPath ? (
          <span>main*</span>
        ) : (
          <span>CLI Assistant</span>
        )}
      </div>
    </footer>
  )
}

export default StatusBar