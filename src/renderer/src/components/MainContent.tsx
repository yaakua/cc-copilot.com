import React from 'react'
import Terminal from './Terminal'
import StatusBar from './StatusBar'
import { useAppStore } from '../stores/appStore'

const MainContent: React.FC = () => {
  const {
    sessions,
    activeSessionId,
    settings,
    setActiveModel
  } = useAppStore()

  const activeSession = sessions.find(s => s.id === activeSessionId)
  const activeProvider = settings.apiProviders.find(p => p.id === settings.activeModelId)

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
    <main className="flex-grow flex flex-col">
      {/* Session Info Bar */}
      <div className="flex-shrink-0 bg-gray-800/50 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <h2 className="font-semibold text-white">
          {activeSession?.name || 'No Session Selected'}
        </h2>
        
        {/* Model Selector */}
        {settings.apiProviders.length > 0 && (
          <div className="relative group">
            <button className="flex items-center gap-2 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-md transition-colors">
              <span className={`font-mono ${activeProvider ? getProviderColor(activeProvider.adapter) : 'text-gray-400'}`}>
                {activeProvider?.name || 'No Provider'}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-2 w-56 bg-gray-700 rounded-md shadow-lg hidden group-hover:block z-10 max-h-64 overflow-y-auto">
              {settings.apiProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleModelChange(provider.id)}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-600 transition-colors ${
                    provider.id === settings.activeModelId 
                      ? `${getProviderColor(provider.adapter)} font-bold bg-gray-800` 
                      : 'text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{provider.name}</span>
                    {provider.id === settings.activeModelId && (
                      <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {provider.adapter} • {provider.baseUrl}
                  </div>
                </button>
              ))}
              
              {settings.apiProviders.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">
                  No providers configured
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Terminal Area */}
      <div className="flex-grow">
        {activeSession ? (
          <Terminal />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium mb-2">No Session Selected</h3>
              <p className="text-sm">Select or create a session to start coding</p>
            </div>
          </div>
        )}
      </div>

      {/* Status and Stats Bar */}
      <StatusBar />
    </main>
  )
}

export default MainContent