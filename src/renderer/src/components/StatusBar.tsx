import React, { useState, useEffect } from 'react'
import { logger } from '../utils/logger'

interface StatusBarProps {
  activeSessionId: string | null
}

interface StatusInfo {
  sessionId: string | null
  projectPath: string
  provider: string
  account: string
  proxy: string
  target: string
}

const StatusBar: React.FC<StatusBarProps> = ({ activeSessionId }) => {
  const [statusInfo, setStatusInfo] = useState<StatusInfo | null>(null)
  const [serviceProviders, setServiceProviders] = useState<any[]>([])
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [activeProvider, setActiveProvider] = useState<any | null>(null)

  useEffect(() => {
    logger.setComponent('StatusBar')
    
    const loadData = async () => {
      try {
        // Load service providers and active provider info
        const [providers, active] = await Promise.all([
          window.api.getServiceProviders(),
          window.api.getActiveProvider()
        ])
        
        setServiceProviders(providers)
        setActiveProvider(active)
        
        // Load current status if there's an active session
        if (activeSessionId) {
          const status = await window.api.getCurrentStatus()
          setStatusInfo(status)
        } else {
          setStatusInfo(null)
        }
      } catch (error) {
        logger.error('加载状态和账号信息失败', error as Error)
      }
    }

    loadData()
    
    // Update status periodically
    const interval = setInterval(async () => {
      try {
        if (activeSessionId) {
          const status = await window.api.getCurrentStatus()
          setStatusInfo(status)
        }
        
        // 更新活动的服务提供方信息（不太频繁）
        const active = await window.api.getActiveProvider()
        setActiveProvider(active)
      } catch (error) {
        logger.error('定期更新状态失败', error as Error)
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [activeSessionId])

  const formatPath = (path: string) => {
    if (!path) return ''
    const segments = path.split('/')
    if (segments.length <= 2) return path
    
    const lastTwo = segments.slice(-2).join('/')
    return `.../${lastTwo}`
  }

  const handleProviderChange = async (providerId: string) => {
    try {
      // 检查是否是Claude官方账号，并且是否需要检查authorization
      const targetProvider = serviceProviders.find(p => p.id === providerId)
      if (targetProvider?.type === 'claude_official') {
        // 检查当前要切换到的提供方是否有账号
        if (targetProvider.accounts && targetProvider.accounts.length > 0) {
          const firstAccount = targetProvider.accounts[0]
          
          // 检查第一个账号是否有authorization，如果没有则提醒用户
          if (!firstAccount.authorization) {
            // 弹窗提醒用户，但不阻止切换
            window.alert(
              `提醒：Claude官方账号 "${firstAccount.emailAddress}" 尚未激活。\n\n` +
              `请先选择任意一个历史会话来激活此账号，否则可能无法正常使用。`
            )
            logger.warn(`切换到未激活的Claude官方账号: ${firstAccount.emailAddress}`)
          }
        }
      }
      
      await window.api.setActiveProvider(providerId)
      
      // 重新加载数据
      const [providers, active] = await Promise.all([
        window.api.getServiceProviders(),
        window.api.getActiveProvider()
      ])
      
      setServiceProviders(providers)
      setActiveProvider(active)
      setShowAccountMenu(false)
      
      logger.info(`切换服务提供方到: ${providerId}`)
    } catch (error) {
      logger.error('切换服务提供方失败', error as Error)
    }
  }

  const handleAccountChange = async (providerId: string, accountId: string) => {
    try {
      // 检查是否是Claude官方账号，并且是否需要检查authorization
      const targetProvider = serviceProviders.find(p => p.id === providerId)
      if (targetProvider?.type === 'claude_official') {
        // 找到要切换的具体账号
        const targetAccount = targetProvider.accounts?.find(account => 
          targetProvider.type === 'claude_official' ? account.emailAddress === accountId : account.id === accountId
        )
        
        if (targetAccount && !targetAccount.authorization) {
          // 弹窗提醒用户，但不阻止切换
          window.alert(
            `提醒：Claude官方账号 "${targetAccount.emailAddress}" 尚未激活。\n\n` +
            `请先选择任意一个历史会话来激活此账号，否则可能无法正常使用。`
          )
          logger.warn(`切换到未激活的Claude官方账号: ${accountId}`)
        }
      }
      
      await window.api.setActiveAccount(providerId, accountId)
      
      // 重新加载活动账号信息
      const active = await window.api.getActiveProvider()
      setActiveProvider(active)
      setShowAccountMenu(false)
      
      logger.info(`切换账号到: ${accountId}`)
    } catch (error) {
      logger.error('切换账号失败', error as Error)
    }
  }

  const handleRefreshClaudeAccounts = async () => {
    try {
      await window.api.refreshClaudeAccounts()
      
      // 重新加载数据
      const [providers, active] = await Promise.all([
        window.api.getServiceProviders(),
        window.api.getActiveProvider()
      ])
      
      setServiceProviders(providers)
      setActiveProvider(active)
      
      logger.info('Claude账号已刷新')
    } catch (error) {
      logger.error('刷新Claude账号失败', error as Error)
    }
  }

  const getAccountDisplayName = (account: any, providerType: string) => {
    if (providerType === 'claude_official') {
      return account.emailAddress || account.organizationName || 'Unknown'
    } else {
      return account.name || 'Unknown'
    }
  }

  return (
    <footer className="flex items-center justify-between px-4 py-1 text-sm shrink-0 relative" style={{ backgroundColor: 'var(--bg-sidebar)', borderTop: '1px solid var(--border-primary)' }}>
      <div className="flex items-center gap-4" style={{ color: 'var(--text-tertiary)' }}>
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div 
            className="status-dot" 
            style={{ backgroundColor: activeSessionId ? 'var(--status-green)' : 'var(--text-tertiary)' }}
          ></div>
          <span>{activeSessionId ? 'Connected' : 'Disconnected'}</span>
        </div>
        
        {/* Account Selector */}
        <div className="relative">
          <div 
            className="flex items-center gap-1 cursor-pointer hover:opacity-80 px-2 py-1 rounded"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            style={{ backgroundColor: showAccountMenu ? 'var(--bg-secondary)' : 'transparent' }}
          >
            <span>
              {activeProvider?.provider ? 
                `${activeProvider.provider.name}: ${activeProvider.account ? getAccountDisplayName(activeProvider.account, activeProvider.provider.type) : 'No Account'}` : 
                'No Provider'
              }
            </span>
            <span style={{ fontSize: '10px' }}>▼</span>
          </div>
          
          {/* Account Selection Dropdown */}
          {showAccountMenu && (
            <div 
              className="absolute bottom-full left-0 mb-1 bg-white border rounded shadow-lg z-50 min-w-64 max-h-80 overflow-y-auto"
              style={{ 
                backgroundColor: 'var(--bg-primary)', 
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)'
              }}
            >
              {/* Header with refresh button */}
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <span className="font-medium">Select Account</span>
                <button 
                  className="text-xs px-2 py-1 rounded hover:opacity-80"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                  onClick={handleRefreshClaudeAccounts}
                >
                  Refresh Claude
                </button>
              </div>
              
              {serviceProviders.map(provider => (
                <div key={provider.id}>
                  {/* Provider Header */}
                  <div 
                    className="px-3 py-2 font-medium border-b"
                    style={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      borderBottom: '1px solid var(--border-primary)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {provider.name} {provider.type === 'claude_official' ? '(Official)' : '(Third-party)'}
                  </div>
                  
                  {/* Accounts List */}
                  {provider.accounts && provider.accounts.length > 0 ? (
                    provider.accounts.map((account: any, index: number) => {
                      const accountId = provider.type === 'claude_official' ? account.emailAddress : account.id
                      const isActive = activeProvider?.provider?.id === provider.id && activeProvider?.account && 
                        (provider.type === 'claude_official' ? 
                          (activeProvider.account as any).emailAddress === account.emailAddress :
                          (activeProvider.account as any).id === account.id
                        )
                      
                      return (
                        <div 
                          key={index}
                          className="px-6 py-2 cursor-pointer hover:opacity-80 flex items-center justify-between"
                          style={{ 
                            backgroundColor: isActive ? 'var(--bg-accent)' : 'transparent',
                            color: isActive ? 'var(--text-accent)' : 'var(--text-primary)'
                          }}
                          onClick={() => {
                            if (activeProvider?.provider?.id !== provider.id) {
                              handleProviderChange(provider.id)
                            } else {
                              handleAccountChange(provider.id, accountId)
                            }
                          }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{getAccountDisplayName(account, provider.type)}</span>
                            <div className="flex items-center gap-1">
                              {/* 显示账号激活状态（仅对Claude官方账号） */}
                              {provider.type === 'claude_official' && (
                                <span 
                                  style={{ 
                                    fontSize: '10px',
                                    color: account.authorization ? 'var(--status-green)' : 'var(--status-orange)',
                                    opacity: 0.8
                                  }}
                                  title={account.authorization ? '已激活' : '未激活 - 需要先使用一个历史会话来激活'}
                                >
                                  {account.authorization ? '●' : '○'}
                                </span>
                              )}
                              {isActive && <span style={{ fontSize: '10px' }}>✓</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="px-6 py-2" style={{ color: 'var(--text-tertiary)' }}>
                      No accounts available
                    </div>
                  )}
                </div>
              ))}
              
              {serviceProviders.length === 0 && (
                <div className="px-3 py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  No service providers configured
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Proxy Info */}
        {statusInfo && (
          <span>
            Proxy: {statusInfo.proxy === 'Disabled' ? 'Off' : statusInfo.proxy}
          </span>
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
      
      {/* Click outside to close menu */}
      {showAccountMenu && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowAccountMenu(false)}
        />
      )}
    </footer>
  )
}

export default StatusBar