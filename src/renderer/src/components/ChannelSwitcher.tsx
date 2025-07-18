import React from 'react'
import { useAppStore } from '../stores/appStore'

const ChannelSwitcher: React.FC = () => {
  const { 
    settings, 
    setActiveModel 
  } = useAppStore()

  const activeProvider = settings.apiProviders.find(p => p.id === settings.activeModelId)

  const getProviderIcon = (adapter: string) => {
    switch (adapter) {
      case 'anthropic':
        return '🔮'
      case 'openai':
        return '💬'
      case 'groq':
        return '⚡'
      case 'moonshot':
        return '🚀'
      default:
        return '🤖'
    }
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

  const handleModelChange = async (providerId: string) => {
    try {
      await setActiveModel(providerId)
    } catch (error) {
      console.error('Failed to change model:', error)
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
      <span className="text-sm font-medium text-gray-300">Model:</span>
      
      {/* Current Model Display */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{getProviderIcon(activeProvider?.adapter || 'default')}</span>
        <span className={`text-sm font-medium ${getProviderColor(activeProvider?.adapter || 'default')}`}>
          {activeProvider?.name || 'No Model Selected'}
        </span>
      </div>

      {/* Model Switcher Dropdown */}
      <div className="relative group">
        <button className="ml-2 p-1 text-gray-400 hover:text-white rounded transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {/* Dropdown Menu */}
        <div className="absolute left-0 mt-2 w-64 bg-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
          <div className="py-1">
            {settings.apiProviders.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleModelChange(provider.id)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-gray-600 flex items-center gap-2 ${
                  provider.id === settings.activeModelId 
                    ? 'bg-gray-600 text-white' 
                    : 'text-gray-300'
                }`}
              >
                <span className="text-base">{getProviderIcon(provider.adapter)}</span>
                <div className="flex-1">
                  <div className={`font-medium ${getProviderColor(provider.adapter)}`}>
                    {provider.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {provider.adapter.charAt(0).toUpperCase() + provider.adapter.slice(1)}
                  </div>
                </div>
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
  )
}

export default ChannelSwitcher