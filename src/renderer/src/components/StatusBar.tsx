import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { logger } from '../utils/logger'
import packageJson from '../../../../package.json'

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
  const { t, i18n } = useTranslation()
  const [statusInfo, setStatusInfo] = useState<StatusInfo | null>(null)
  const [serviceProviders, setServiceProviders] = useState<any[]>([])
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
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
    
    // Listen for settings changes
    const unsubscribeServiceProviders = window.api.onServiceProvidersUpdated((providers) => {
      setServiceProviders(providers)
    })
    
    const unsubscribeActiveProvider = window.api.onActiveServiceProviderChanged(async () => {
      // Reload active provider data when it changes
      const active = await window.api.getActiveProvider()
      setActiveProvider(active)
    })
    
    const unsubscribeActiveAccount = window.api.onActiveAccountChanged(async () => {
      // Reload active provider data when active account changes
      const active = await window.api.getActiveProvider()
      setActiveProvider(active)
    })
    
    return () => {
      clearInterval(interval)
      unsubscribeServiceProviders()
      unsubscribeActiveProvider()
      unsubscribeActiveAccount()
    }
  }, [activeSessionId])

  const formatPath = (path: string) => {
    if (!path) return ''
    const segments = path.split('/')
    if (segments.length <= 2) return path
    
    const lastTwo = segments.slice(-2).join('/')
    return `.../${lastTwo}`
  }

  const sendProviderSwitchMessage = async (provider: any, account: any) => {
    try {
      if (!activeSessionId) return // Only send messages if there's an active terminal session
      
      const providerName = provider.name || 'Unknown Provider'
      const isOfficial = provider.type === 'claude_official'
      const providerType = isOfficial ? 'Official' : 'Third-party'
      
      // Get API endpoint
      let apiEndpoint = 'Unknown'
      if (isOfficial) {
        apiEndpoint = 'https://api.anthropic.com'
      } else if (account?.baseUrl) {
        apiEndpoint = account.baseUrl
      }
      
      // Format message with ANSI colors
      const message = `\x1b[36m🔄 [Provider Switch] Switched to: ${providerName} (${providerType})\x1b[0m\n` +
                    `\x1b[36m📡 API Endpoint: ${apiEndpoint}\x1b[0m`
      
      await window.api.sendSystemMessage(message)
      
      logger.info(`终端日志已发送 - 切换到提供商: ${providerName}`)
    } catch (error) {
      logger.error('发送终端切换消息失败', error as Error)
    }
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
            window.alert(t('statusBar.providerSwitchAlert', { email: firstAccount.emailAddress }))
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
      
      // Send terminal message for provider switch
      if (active?.provider) {
        await sendProviderSwitchMessage(active.provider, active.account)
      }
      
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
        const targetAccount = targetProvider.accounts?.find((account: any) => 
          targetProvider.type === 'claude_official' ? account.emailAddress === accountId : account.id === accountId
        )
        
        if (targetAccount && !targetAccount.authorization) {
          // 弹窗提醒用户，但不阻止切换
          window.alert(t('statusBar.providerSwitchAlert', { email: targetAccount.emailAddress }))
          logger.warn(`切换到未激活的Claude官方账号: ${accountId}`)
        }
      }
      
      await window.api.setActiveAccount(providerId, accountId)
      
      // 重新加载活动账号信息
      const active = await window.api.getActiveProvider()
      setActiveProvider(active)
      setShowAccountMenu(false)
      
      // Send terminal message for account switch
      if (active?.provider) {
        await sendProviderSwitchMessage(active.provider, active.account)
      }
      
      logger.info(`切换账号到: ${accountId}`)
    } catch (error) {
      logger.error('切换账号失败', error as Error)
    }
  }

  const handleRefreshAccounts = async () => {
    try {
      // Refresh Claude official accounts from .claude.json
      await window.api.refreshClaudeAccounts()
      
      // Reload all service providers (both Claude official and third-party)
      const [providers, active] = await Promise.all([
        window.api.getServiceProviders(),
        window.api.getActiveProvider()
      ])
      
      setServiceProviders(providers)
      setActiveProvider(active)
      
      logger.info('所有账号已刷新')
    } catch (error) {
      logger.error('刷新账号失败', error as Error)
    }
  }

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language)
    setShowLanguageMenu(false)
    logger.info(`语言切换到: ${language}`)
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
          <span>{activeSessionId ? t('statusBar.connected') : t('statusBar.disconnected')}</span>
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
                `${activeProvider.provider.name}: ${activeProvider.account ? getAccountDisplayName(activeProvider.account, activeProvider.provider.type) : t('statusBar.noAccount')}` : 
                t('statusBar.noProvider')
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
                <span className="font-medium">{t('statusBar.selectAccount')}</span>
                <button 
                  className="text-xs px-2 py-1 rounded hover:opacity-80"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                  onClick={handleRefreshAccounts}
                >
                  {t('statusBar.refreshAccounts')}
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
                    {provider.name} ({provider.type === 'claude_official' ? t('statusBar.official') : t('statusBar.thirdParty')})
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
                                  title={account.authorization ? t('statusBar.activated') : t('statusBar.notActivated')}
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
                      {t('statusBar.noAccountsAvailable')}
                    </div>
                  )}
                </div>
              ))}
              
              {serviceProviders.length === 0 && (
                <div className="px-3 py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  {t('statusBar.noServiceProviders')}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Proxy Info */}
        {statusInfo && (
          <span>
            {t('statusBar.proxy')}: {statusInfo.proxy === 'Disabled' ? t('statusBar.off') : statusInfo.proxy}
          </span>
        )}
        
        {/* Language Switcher */}
        <div className="relative">
          <div 
            className="flex items-center gap-1 cursor-pointer hover:opacity-80 px-2 py-1 rounded"
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            style={{ backgroundColor: showLanguageMenu ? 'var(--bg-secondary)' : 'transparent' }}
          >
            <span style={{ fontSize: '12px' }}>🌐</span>
            <span>{i18n.language === 'zh-CN' ? '中' : 'EN'}</span>
            <span style={{ fontSize: '10px' }}>▼</span>
          </div>
          
          {/* Language Selection Dropdown */}
          {showLanguageMenu && (
            <div 
              className="absolute bottom-full left-0 mb-1 bg-white border rounded shadow-lg z-50 min-w-32"
              style={{ 
                backgroundColor: 'var(--bg-primary)', 
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)'
              }}
            >
              <div 
                className="px-3 py-2 cursor-pointer hover:opacity-80 flex items-center gap-2"
                style={{ 
                  backgroundColor: i18n.language === 'en' ? 'var(--bg-accent)' : 'transparent',
                  color: i18n.language === 'en' ? 'var(--text-accent)' : 'var(--text-primary)'
                }}
                onClick={() => handleLanguageChange('en')}
              >
                <span>🇺🇸</span>
                <span>English</span>
                {i18n.language === 'en' && <span style={{ fontSize: '10px', marginLeft: 'auto' }}>✓</span>}
              </div>
              
              <div 
                className="px-3 py-2 cursor-pointer hover:opacity-80 flex items-center gap-2"
                style={{ 
                  backgroundColor: i18n.language === 'zh-CN' ? 'var(--bg-accent)' : 'transparent',
                  color: i18n.language === 'zh-CN' ? 'var(--text-accent)' : 'var(--text-primary)'
                }}
                onClick={() => handleLanguageChange('zh-CN')}
              >
                <span>🇨🇳</span>
                <span>简体中文</span>
                {i18n.language === 'zh-CN' && <span style={{ fontSize: '10px', marginLeft: 'auto' }}>✓</span>}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Right side - Git/Project info, Version and Help */}
      <div className="flex items-center gap-4" style={{ color: 'var(--text-tertiary)' }}>
        <div>
          {statusInfo && statusInfo.projectPath ? (
            <span>main*</span>
          ) : (
            <span></span>
          )}
        </div>
        <div className="text-xs">
          v{packageJson.version}
        </div>
        <button 
          onClick={() => window.open('https://cc-copilot.com?ref=cc-copilot', '_blank')}
          className="flex items-center gap-1 px-2 py-1 rounded hover:opacity-80 transition-opacity"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--text-tertiary)'
          }}
          title={t('statusBar.clickToOpenWebsite')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" strokeWidth="1.5" stroke="currentColor" className="w-3 h-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 0 0-5.656-5.656l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0-5.656 5.656l4-4Z"/>
          </svg>
          <span className="text-xs">cc-copilot.com</span>
        </button>
      </div>
      
      {/* Click outside to close menus */}
      {showAccountMenu && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowAccountMenu(false)}
        />
      )}
      {showLanguageMenu && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowLanguageMenu(false)}
        />
      )}
    </footer>
  )
}

export default StatusBar