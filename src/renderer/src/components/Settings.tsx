import React, { useState, useEffect } from 'react'

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
  host: string
  port: number
  protocol: 'http' | 'https'
  username?: string
  password?: string
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
  const [aiProviders, setAiProviders] = useState<AIProvider[]>([])
  const [proxySettings, setProxySettings] = useState<ProxySettings>({
    enabled: false,
    host: '',
    port: 8080,
    protocol: 'http'
  })
  const [activeTab, setActiveTab] = useState<'general' | 'providers' | 'proxy'>('general')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const savedProviders = await window.api.getAIProviders?.() || []
      const savedProxy = await window.api.getProxySettings?.() || proxySettings
      setAiProviders(savedProviders)
      setProxySettings(savedProxy)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveAIProviders = async (providers: AIProvider[]) => {
    try {
      await window.api.saveAIProviders?.(providers)
      setAiProviders(providers)
    } catch (error) {
      console.error('Failed to save AI providers:', error)
    }
  }

  const saveProxySettings = async (settings: ProxySettings) => {
    try {
      await window.api.saveProxySettings?.(settings)
      setProxySettings(settings)
    } catch (error) {
      console.error('Failed to save proxy settings:', error)
    }
  }

  const addAIProvider = () => {
    const newProvider: AIProvider = {
      id: Date.now().toString(),
      name: '',
      apiUrl: '',
      apiKey: ''
    }
    const updatedProviders = [...aiProviders, newProvider]
    saveAIProviders(updatedProviders)
  }

  const updateAIProvider = (id: string, field: keyof AIProvider, value: string) => {
    const updatedProviders = aiProviders.map(provider =>
      provider.id === id ? { ...provider, [field]: value } : provider
    )
    saveAIProviders(updatedProviders)
  }

  const removeAIProvider = (id: string) => {
    const updatedProviders = aiProviders.filter(provider => provider.id !== id)
    saveAIProviders(updatedProviders)
  }

  const updateProxySettings = (field: keyof ProxySettings, value: any) => {
    const updatedSettings = { ...proxySettings, [field]: value }
    saveProxySettings(updatedSettings)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-[600px] max-w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Tab Navigation */}
          <div className="w-48 bg-gray-900 border-r border-gray-700 p-4">
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
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Protocol</label>
                          <select
                            value={proxySettings.protocol}
                            onChange={(e) => updateProxySettings('protocol', e.target.value as 'http' | 'https')}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                          >
                            <option value="http">HTTP</option>
                            <option value="https">HTTPS</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">Port</label>
                          <input
                            type="number"
                            value={proxySettings.port}
                            onChange={(e) => updateProxySettings('port', parseInt(e.target.value) || 8080)}
                            min="1"
                            max="65535"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">Host</label>
                        <input
                          type="text"
                          value={proxySettings.host}
                          onChange={(e) => updateProxySettings('host', e.target.value)}
                          placeholder="proxy.company.com"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                        />
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
                        <p>Proxy URL will be: {proxySettings.protocol}://{proxySettings.username ? '[username]:[password]@' : ''}{proxySettings.host}:{proxySettings.port}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default Settings