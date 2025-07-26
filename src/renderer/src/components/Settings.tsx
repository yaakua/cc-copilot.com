import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface ClaudeDetectionResult {
  isInstalled: boolean
  version?: string
  path?: string
  error?: string
  timestamp: number
}

interface AIProvider {
  id: string
  name: string
  apiUrl: string
  apiKey: string
}

interface ProxySettings {
  enabled: boolean
  url: string
  username?: string
  password?: string
}

interface ClaudeAccount {
  accountUuid: string
  emailAddress: string
  organizationUuid: string
  organizationRole: string
  workspaceRole: string | null
  organizationName: string
  authorization?: string
}

interface ServiceProvider {
  id: string
  type: 'claude_official' | 'third_party'
  name: string
  accounts: ClaudeAccount[]
  activeAccountId: string
  useProxy: boolean
}

interface SettingsProps {
  claudeDetectionResult: ClaudeDetectionResult | null
  claudeDetecting: boolean
  onRedetectClaude: () => void
  onClose: () => void
}

const Settings: React.FC<SettingsProps> = ({
  claudeDetectionResult,
  claudeDetecting,
  onRedetectClaude,
  onClose
}) => {
  const { t, i18n } = useTranslation()
  const [aiProviders, setAiProviders] = useState<AIProvider[]>([])
  const [proxySettings, setProxySettings] = useState<ProxySettings>({
    enabled: false,
    url: 'http://127.0.0.1:1087'
  })
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([])
  const [detectingAuth, setDetectingAuth] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<'general' | 'accounts' | 'providers' | 'proxy' | 'language'>('general')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await window.api.getSettings()
      setProxySettings({
        enabled: settings?.proxyConfig?.enabled || false,
        url: settings?.proxyConfig?.url || 'http://127.0.0.1:1087',
        username: settings?.proxyConfig?.auth?.username,
        password: settings?.proxyConfig?.auth?.password
      })
      
      // Load service providers
      const providers = await window.api.getServiceProviders()
      setServiceProviders(providers || [])
      
      // Convert third-party service providers to AI providers for the UI
      // Only load providers that were created from AI provider settings (have third_party_ prefix)
      const thirdPartyProviders = providers?.filter(p => 
        p.type === 'third_party' && p.id.startsWith('third_party_')
      ) || []
      const aiProvidersFromService = thirdPartyProviders.map(provider => {
        // Get the first account as the provider info
        const account = provider.accounts?.[0]
        return {
          id: account?.id || provider.id.replace('third_party_', ''),
          name: provider.name || account?.name || 'Unnamed Provider',
          apiUrl: account?.baseUrl || '',
          apiKey: account?.apiKey || ''
        }
      })
      
      // Also load legacy apiProviders for backward compatibility
      const legacyProviders = settings?.apiProviders || []
      
      // Combine both sources, preferring service providers
      const combinedProviders = [...aiProvidersFromService]
      legacyProviders.forEach((legacy: any) => {
        if (!combinedProviders.some(p => p.id === legacy.id)) {
          combinedProviders.push(legacy)
        }
      })
      
      setAiProviders(combinedProviders)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveSettings = async () => {
    try {
      // Save proxy settings
      const settingsToSave = {
        proxyConfig: {
          enabled: proxySettings.enabled,
          url: proxySettings.url,
          auth: proxySettings.username || proxySettings.password ? {
            username: proxySettings.username || '',
            password: proxySettings.password || ''
          } : undefined
        }
      }
      await window.api.updateSettings(settingsToSave)

      // Save AI providers as third-party service providers
      for (const provider of aiProviders) {
        const providerId = `third_party_${provider.id}`
        const account = {
          id: provider.id,
          name: provider.name,
          apiKey: provider.apiKey,
          baseUrl: provider.apiUrl,
          description: `API Provider: ${provider.name}`
        }
        await window.api.addThirdPartyAccount(providerId, account)
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const addAIProvider = () => {
    const newProvider: AIProvider = {
      id: Date.now().toString(),
      name: '',
      apiUrl: '',
      apiKey: ''
    }
    setAiProviders([...aiProviders, newProvider])
  }

  const updateAIProvider = (id: string, field: keyof AIProvider, value: string) => {
    const updatedProviders = aiProviders.map(provider =>
      provider.id === id ? { ...provider, [field]: value } : provider
    )
    setAiProviders(updatedProviders)
  }

  const removeAIProvider = async (id: string) => {
    try {
      // Remove from service providers if it exists there
      const providers = await window.api.getServiceProviders()
      const providerId = `third_party_${id}`
      const existingProvider = providers.find(p => p.id === providerId && p.type === 'third_party')
      if (existingProvider && existingProvider.accounts.length > 0) {
        const account = existingProvider.accounts[0]
        await window.api.removeThirdPartyAccount(providerId, account.id)
      }
      
      // Remove from local state
      const updatedProviders = aiProviders.filter(provider => provider.id !== id)
      setAiProviders(updatedProviders)
    } catch (error) {
      console.error('Failed to remove AI provider:', error)
      // Still remove from local state even if API call fails
      const updatedProviders = aiProviders.filter(provider => provider.id !== id)
      setAiProviders(updatedProviders)
    }
  }

  const updateProxySettings = (field: keyof ProxySettings, value: any) => {
    const updatedSettings = { ...proxySettings, [field]: value }
    setProxySettings(updatedSettings)
  }

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language)
  }

  const detectAuthorization = async (accountEmail: string) => {
    try {
      setDetectingAuth(prev => ({ ...prev, [accountEmail]: true }))
      console.log(`开始检测账号: ${accountEmail}`)
      
      const result = await window.api.detectClaudeAuthorization(accountEmail)
      console.log('检测结果:', result)
      
      if (result.success) {
        // Reload service providers to get updated authorization
        await loadSettings() // 重新加载所有设置，包括更新的authorization值
        
        // Show success message
        console.log('账号检测成功')
        // You could add a toast notification here instead of console.log
      } else {
        console.error('账号检测失败:', result.error)
        
        // Provide more user-friendly error messages
        let userMessage = t('settings.detectFailed')
        if (result.error?.includes('超时')) {
          userMessage = t('settings.detectTimeout')
        } else if (result.error?.includes('命令失败')) {
          userMessage = t('settings.commandFailed')
        } else if (result.error?.includes('未选择')) {
          userMessage = t('settings.noAccountSelected')
        }
        
        alert(`${userMessage}\n\n详细信息: ${result.error}`)
      }
    } catch (error) {
      console.error('检测账号时出错:', error)
      alert(t('settings.networkError'))
    } finally {
      setDetectingAuth(prev => ({ ...prev, [accountEmail]: false }))
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-[900px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Tab Navigation */}
          <div className="w-56 bg-gray-900 border-r border-gray-700 p-4">
            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab('general')}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeTab === 'general' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab('accounts')}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeTab === 'accounts' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Accounts
              </button>
              <button
                onClick={() => setActiveTab('providers')}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeTab === 'providers' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                AI Providers
              </button>
              <button
                onClick={() => setActiveTab('proxy')}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeTab === 'proxy' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Proxy
              </button>
              <button
                onClick={() => setActiveTab('language')}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeTab === 'language' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Language
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-6 overflow-auto">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium">Claude CLI Status</h3>
                    <button
                      onClick={onRedetectClaude}
                      disabled={claudeDetecting}
                      className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors"
                    >
                      {claudeDetecting ? 'Detecting...' : 'Re-detect'}
                    </button>
                  </div>
                  
                  {claudeDetectionResult ? (
                    <div className="space-y-3">
                      <div className={`text-sm flex items-center gap-2 ${claudeDetectionResult.isInstalled ? 'text-green-400' : 'text-red-400'}`}>
                        <span>{claudeDetectionResult.isInstalled ? '✓' : '✗'}</span>
                        <span>
                          {claudeDetectionResult.isInstalled 
                            ? `Claude CLI installed ${claudeDetectionResult.version ? `(${claudeDetectionResult.version})` : ''}`
                            : `Claude CLI not found`
                          }
                        </span>
                      </div>
                      
                      {claudeDetectionResult.path && (
                        <div className="text-sm text-gray-400">
                          Path: {claudeDetectionResult.path}
                        </div>
                      )}
                      
                      {claudeDetectionResult.error && (
                        <div className="text-sm text-red-400">
                          Error: {claudeDetectionResult.error}
                        </div>
                      )}
                      
                      <div className="text-sm text-gray-500">
                        Last checked: {new Date(claudeDetectionResult.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">
                      {claudeDetecting ? 'Detecting Claude CLI...' : 'Detection status unknown'}
                    </div>
                  )}
                  
                  {!claudeDetectionResult?.isInstalled && (
                    <>
                      <p className="text-sm text-gray-400 mt-3 mb-2">
                        Claude CLI is required for terminal sessions. Install with:
                      </p>
                      <code className="block bg-gray-900 p-3 rounded text-sm text-green-400">
                        npm install -g @anthropic-ai/claude-code
                      </code>
                    </>
                  )}
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-3">Project Management</h3>
                  <p className="text-sm text-gray-400">
                    Projects are automatically discovered from your Claude projects directory.
                    Create new sessions within projects to start coding.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-3">Keyboard Shortcuts</h3>
                  <div className="text-sm text-gray-400 space-y-1">
                    <div>Ctrl/Cmd + C: Copy in terminal</div>
                    <div>Ctrl/Cmd + V: Paste in terminal</div>
                    <div>Ctrl/Cmd + L: Clear terminal</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'accounts' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Claude Official Accounts</h3>
                
                {serviceProviders
                  .filter(provider => provider.type === 'claude_official')
                  .map(provider => (
                    <div key={provider.id} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-blue-400">{provider.name}</h4>
                        <span className="text-sm text-gray-400">
                          {provider.accounts.length} account{provider.accounts.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      {provider.accounts.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <p>No Claude accounts found</p>
                          <p className="text-sm mt-1">Please login with 'claude login' first</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {provider.accounts.map((account) => (
                            <div key={account.accountUuid} className="bg-gray-700 p-4 rounded-lg">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <h5 className="font-medium">{account.emailAddress}</h5>
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        account.authorization 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-red-100 text-red-800'
                                      }`}>
                                        {account.authorization ? '✓ Account Available' : '✗ Need Detection'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="mt-2 space-y-1 text-sm text-gray-300">
                                    <div>Organization: {account.organizationName}</div>
                                    <div>Role: {account.organizationRole}</div>
                                    {account.workspaceRole && (
                                      <div>Workspace Role: {account.workspaceRole}</div>
                                    )}
                                  </div>
                                  
                                  {account.authorization && (
                                    <div className="mt-2 text-xs text-green-400">
                                      ✓ Account verified and ready to use
                                    </div>
                                  )}
                                </div>
                                
                                <div className="ml-4">
                                  <button
                                    onClick={() => detectAuthorization(account.emailAddress)}
                                    disabled={detectingAuth[account.emailAddress]}
                                    className={`px-3 py-2 text-sm rounded transition-colors ${
                                      account.authorization
                                        ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600'
                                        : 'bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600'
                                    }`}
                                  >
                                    {detectingAuth[account.emailAddress] 
                                      ? 'Detecting...' 
                                      : account.authorization 
                                        ? 'Re-detect' 
                                        : 'Detect Account'
                                    }
                                  </button>
                                </div>
                              </div>
                              
                              {!account.authorization && (
                                <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded text-sm text-yellow-300">
                                  <p className="font-medium">Account Detection Required</p>
                                  <p className="mt-1">
                                    Click "Detect Account" to verify this account is properly configured 
                                    and available for use with Claude Code.
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                }
                
                {serviceProviders.filter(p => p.type === 'claude_official').length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p>No Claude official accounts configured</p>
                    <p className="text-sm mt-1">Please login with 'claude login' first</p>
                  </div>
                )}
                
                <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700/50 rounded">
                  <h4 className="font-medium text-blue-300 mb-2">How to add Claude accounts:</h4>
                  <ol className="text-sm text-blue-200 space-y-1 list-decimal list-inside">
                    <li>Open terminal and run: <code className="bg-gray-800 px-1 rounded">claude login</code></li>
                    <li>Complete the login process in your browser</li>
                    <li>Restart this application to see the new account</li>
                    <li>Click "Detect Account" to verify the account is available</li>
                  </ol>
                </div>
              </div>
            )}

            {activeTab === 'providers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">AI Providers</h3>
                  <button
                    onClick={addAIProvider}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                  >
                    + Add Provider
                  </button>
                </div>
                
                <div className="space-y-4">
                  {aiProviders.map((provider) => (
                    <div key={provider.id} className="bg-gray-700 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">Provider Configuration</h4>
                        <button
                          onClick={() => removeAIProvider(provider.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Name</label>
                          <input
                            type="text"
                            value={provider.name}
                            onChange={(e) => updateAIProvider(provider.id, 'name', e.target.value)}
                            placeholder="e.g., Claude API, OpenAI"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">API URL</label>
                          <input
                            type="url"
                            value={provider.apiUrl}
                            onChange={(e) => updateAIProvider(provider.id, 'apiUrl', e.target.value)}
                            placeholder="https://api.anthropic.com"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">API Key</label>
                          <input
                            type="password"
                            value={provider.apiKey}
                            onChange={(e) => updateAIProvider(provider.id, 'apiKey', e.target.value)}
                            placeholder="sk-..."
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {aiProviders.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <p>No AI providers configured</p>
                      <p className="text-sm mt-1">Click "Add Provider" to get started</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'proxy' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Upstream Proxy Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="proxy-enabled"
                      checked={proxySettings.enabled}
                      onChange={(e) => updateProxySettings('enabled', e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="proxy-enabled" className="text-sm font-medium">
                      Enable Proxy
                    </label>
                  </div>
                  
                  {proxySettings.enabled && (
                    <div className="space-y-4 pl-6 border-l border-gray-600">
                      <div>
                        <label className="block text-sm font-medium mb-1">Proxy URL</label>
                        <input
                          type="text"
                          value={proxySettings.url}
                          onChange={(e) => updateProxySettings('url', e.target.value)}
                          placeholder="http://127.0.0.1:1087"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Examples: http://127.0.0.1:1087, https://proxy.example.com:8080
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Username (Optional)</label>
                          <input
                            type="text"
                            value={proxySettings.username || ''}
                            onChange={(e) => updateProxySettings('username', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">Password (Optional)</label>
                          <input
                            type="password"
                            value={proxySettings.password || ''}
                            onChange={(e) => updateProxySettings('password', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-400">
                        <p>Final proxy URL: {proxySettings.url}{proxySettings.username ? ' (with authentication)' : ''}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'language' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Language Settings</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-3">Interface Language</label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="language"
                          value="en"
                          checked={i18n.language === 'en'}
                          onChange={(e) => changeLanguage(e.target.value)}
                          className="mr-3"
                        />
                        <span>English</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="language"
                          value="zh-CN"
                          checked={i18n.language === 'zh-CN'}
                          onChange={(e) => changeLanguage(e.target.value)}
                          className="mr-3"
                        />
                        <span>简体中文</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700/50 rounded">
                    <h4 className="font-medium text-blue-300 mb-2">Note:</h4>
                    <p className="text-sm text-blue-200">
                      Language changes take effect immediately. Log messages will remain in English for debugging purposes.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-700 flex justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              // Save all settings before closing
              await saveSettings()
              onClose()
            }}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors ml-3"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default Settings