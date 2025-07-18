import React, { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { ApiProvider } from '../../../preload/index.d'

const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setSettingsOpen,
    settings,
    updateSettings,
    setActiveModel
  } = useAppStore()
  
  const [localSettings, setLocalSettings] = useState(settings)
  const [isAddingProvider, setIsAddingProvider] = useState(false)
  const [newProvider, setNewProvider] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    adapter: 'anthropic'
  })
  const [autoLogin, setAutoLogin] = useState(false)
  const [claudeAuth, setClaudeAuth] = useState<any>(null)
  const [configStatus, setConfigStatus] = useState<any>(null)
  const [showConfigDebug, setShowConfigDebug] = useState(false)

  useEffect(() => {
    setLocalSettings(settings)
    loadAuthSettings()
  }, [settings])

  const loadAuthSettings = async () => {
    try {
      const autoLoginSetting = await window.electron.ipcRenderer.invoke('auth:get-auto-login')
      const claudeAuthData = await window.electron.ipcRenderer.invoke('auth:get-claude-official')
      const configStatusData = await window.electron.ipcRenderer.invoke('auth:get-config-status')
      setAutoLogin(autoLoginSetting)
      setClaudeAuth(claudeAuthData)
      setConfigStatus(configStatusData)
    } catch (error) {
      console.error('Failed to load auth settings:', error)
    }
  }

  const handleSave = async () => {
    try {
      await updateSettings(localSettings)
      await window.electron.ipcRenderer.invoke('auth:set-auto-login', autoLogin)
      setSettingsOpen(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const handleCancel = () => {
    setLocalSettings(settings) // Reset to original settings
    setIsAddingProvider(false)
    setNewProvider({ name: '', baseUrl: '', apiKey: '', adapter: 'anthropic' })
    loadAuthSettings() // Reset auth settings
    setSettingsOpen(false)
  }

  const handleAddProvider = () => {
    if (!newProvider.name.trim() || !newProvider.baseUrl.trim()) return

    const provider: ApiProvider = {
      id: Date.now().toString(),
      name: newProvider.name.trim(),
      baseUrl: newProvider.baseUrl.trim(),
      apiKey: newProvider.apiKey.trim(),
      adapter: newProvider.adapter
    }

    setLocalSettings({
      ...localSettings,
      apiProviders: [...localSettings.apiProviders, provider]
    })

    setNewProvider({ name: '', baseUrl: '', apiKey: '', adapter: 'anthropic' })
    setIsAddingProvider(false)
  }

  const handleRemoveProvider = (providerId: string) => {
    if (window.confirm('Are you sure you want to remove this API provider?')) {
      setLocalSettings({
        ...localSettings,
        apiProviders: localSettings.apiProviders.filter(p => p.id !== providerId)
      })
    }
  }

  const handleProviderChange = (providerId: string, field: keyof ApiProvider, value: string) => {
    setLocalSettings({
      ...localSettings,
      apiProviders: localSettings.apiProviders.map(p =>
        p.id === providerId ? { ...p, [field]: value } : p
      )
    })
  }

  const getProviderColor = (adapter: string) => {
    const colors = {
      anthropic: 'text-orange-400',
      openai: 'text-green-400',
      groq: 'text-purple-400',
      moonshot: 'text-blue-400',
      default: 'text-cyan-400'
    }
    return colors[adapter as keyof typeof colors] || colors.default
  }

  const handleSetActiveProvider = async (providerId: string) => {
    try {
      await setActiveModel(providerId)
    } catch (error) {
      console.error('Failed to set active provider:', error)
    }
  }

  const handleSetupClaudeAuth = async () => {
    try {
      await window.electron.ipcRenderer.invoke('auth:setup-claude-official')
      await loadAuthSettings()
    } catch (error) {
      console.error('Failed to setup Claude auth:', error)
    }
  }

  const handleRemoveClaudeAuth = async () => {
    if (claudeAuth && window.confirm('Are you sure you want to remove Claude official authentication?')) {
      try {
        await window.electron.ipcRenderer.invoke('auth:remove-auth', claudeAuth.id)
        await loadAuthSettings()
      } catch (error) {
        console.error('Failed to remove Claude auth:', error)
      }
    }
  }

  if (!isSettingsOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-grow">
          <div className="space-y-8">
            {/* API Providers Section */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">API Providers</h3>
              <div className="space-y-4">
                {localSettings.apiProviders.map((provider) => (
                  <div key={provider.id} className="bg-gray-700/50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`font-bold ${getProviderColor(provider.adapter)}`}>
                          {provider.name}
                        </span>
                        {settings.activeModelId === provider.id && (
                          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {settings.activeModelId !== provider.id && (
                          <button
                            onClick={() => handleSetActiveProvider(provider.id)}
                            className="text-xs text-blue-400 hover:underline"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveProvider(provider.id)}
                          className="text-xs text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Provider Name</label>
                        <input
                          type="text"
                          value={provider.name}
                          onChange={(e) => handleProviderChange(provider.id, 'name', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Adapter Type</label>
                        <select
                          value={provider.adapter}
                          onChange={(e) => handleProviderChange(provider.id, 'adapter', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-2 text-sm"
                        >
                          <option value="anthropic">Anthropic</option>
                          <option value="openai">OpenAI</option>
                          <option value="groq">Groq</option>
                          <option value="moonshot">Moonshot</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Base URL</label>
                        <input
                          type="url"
                          value={provider.baseUrl}
                          onChange={(e) => handleProviderChange(provider.id, 'baseUrl', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-2 text-sm"
                          placeholder="https://api.example.com/v1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
                        <input
                          type="password"
                          value={provider.apiKey}
                          onChange={(e) => handleProviderChange(provider.id, 'apiKey', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-2 text-sm"
                          placeholder="sk-..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Add New Provider Form */}
                {isAddingProvider ? (
                  <div className="bg-gray-700/50 p-4 rounded-lg border-2 border-dashed border-gray-600">
                    <h4 className="text-sm font-semibold text-white mb-3">Add New Provider</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Provider Name</label>
                        <input
                          type="text"
                          value={newProvider.name}
                          onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-2 text-sm"
                          placeholder="e.g., My OpenAI"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Adapter Type</label>
                        <select
                          value={newProvider.adapter}
                          onChange={(e) => setNewProvider({ ...newProvider, adapter: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-2 text-sm"
                        >
                          <option value="anthropic">Anthropic</option>
                          <option value="openai">OpenAI</option>
                          <option value="groq">Groq</option>
                          <option value="moonshot">Moonshot</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Base URL</label>
                        <input
                          type="url"
                          value={newProvider.baseUrl}
                          onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-2 text-sm"
                          placeholder="https://api.example.com/v1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
                        <input
                          type="password"
                          value={newProvider.apiKey}
                          onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-2 text-sm"
                          placeholder="sk-..."
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddProvider}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                      >
                        Add Provider
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingProvider(false)
                          setNewProvider({ name: '', baseUrl: '', apiKey: '', adapter: 'anthropic' })
                        }}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingProvider(true)}
                    className="w-full text-sm bg-gray-600 hover:bg-gray-500 py-3 rounded-md transition-colors border-2 border-dashed border-gray-600"
                  >
                    + Add New Provider
                  </button>
                )}
              </div>
            </div>
            
            {/* Authentication Settings */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Authentication</h3>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoLogin}
                      onChange={(e) => setAutoLogin(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                    />
                    <span className="text-sm text-gray-300">Auto-login with Claude official account</span>
                  </label>
                  <p className="text-xs text-gray-400 mt-1">
                    Automatically use Claude official authentication when available
                  </p>
                </div>
                
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-white">Claude Official Authentication</h4>
                    {claudeAuth && (
                      <span className="text-xs text-green-400 bg-green-900 px-2 py-1 rounded">
                        Connected
                      </span>
                    )}
                  </div>
                  
                  {claudeAuth ? (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-300">
                        <span className="font-medium">User:</span> {claudeAuth.username || claudeAuth.email || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-300">
                        <span className="font-medium">Last Login:</span> {
                          claudeAuth.lastLoginAt ? new Date(claudeAuth.lastLoginAt).toLocaleDateString() : 'Unknown'
                        }
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={handleSetupClaudeAuth}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        >
                          Refresh
                        </button>
                        <button
                          onClick={handleRemoveClaudeAuth}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-400">
                        No Claude official authentication found. Make sure you have logged in with claude-code CLI.
                      </p>
                      <button
                        onClick={handleSetupClaudeAuth}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                      >
                        Detect Authentication
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Config Debug Info */}
                <div className="bg-gray-700/50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-white">Configuration Detection</h4>
                    <button
                      onClick={() => setShowConfigDebug(!showConfigDebug)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {showConfigDebug ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>
                  
                  {configStatus && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-300">
                        <span className="font-medium">Found configs:</span> {configStatus.foundPaths?.length || 0}
                      </div>
                      <div className="text-sm text-gray-300">
                        <span className="font-medium">Valid auth configs:</span> {configStatus.validConfigs?.length || 0}
                      </div>
                      
                      {showConfigDebug && (
                        <div className="mt-3 space-y-2">
                          <div className="text-xs text-gray-400">
                            <div className="font-medium mb-1">Search paths:</div>
                            <div className="max-h-32 overflow-y-auto text-xs font-mono bg-gray-800 p-2 rounded">
                              {configStatus.searchedPaths?.map((path: string, index: number) => (
                                <div key={index} className={configStatus.foundPaths?.includes(path) ? 'text-green-400' : 'text-gray-500'}>
                                  {configStatus.foundPaths?.includes(path) ? '✓' : '✗'} {path}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {configStatus.validConfigs?.length > 0 && (
                            <div className="text-xs text-gray-400">
                              <div className="font-medium mb-1">Valid configurations:</div>
                              <div className="space-y-1">
                                {configStatus.validConfigs.map((config: any, index: number) => (
                                  <div key={index} className="text-xs bg-gray-800 p-2 rounded">
                                    <div className="text-green-400">{config.path}</div>
                                    <div className="text-gray-300">
                                      Auth: {config.hasAuth ? 'Yes' : 'No'}
                                      {config.username && ` | User: ${config.username}`}
                                      {config.email && ` | Email: ${config.email}`}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* General Settings */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">General</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="proxy-url" className="block text-sm font-medium text-gray-300 mb-1">
                    HTTP(S) Proxy (Optional)
                  </label>
                  <input
                    type="text"
                    id="proxy-url"
                    value={localSettings.proxy || ''}
                    onChange={(e) => setLocalSettings({ ...localSettings, proxy: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-2 text-sm"
                    placeholder="http://127.0.0.1:7890"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-700 flex justify-end gap-4">
          <button
            onClick={handleCancel}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-md transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal