import React, { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'

interface EnvManagerProps {
  isOpen: boolean
  onClose: () => void
}

const EnvManager: React.FC<EnvManagerProps> = ({ isOpen, onClose }) => {
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { activeSessionId } = useAppStore()

  useEffect(() => {
    if (isOpen && activeSessionId) {
      loadEnvironmentVariables()
    }
  }, [isOpen, activeSessionId])

  const loadEnvironmentVariables = async () => {
    if (!window.api?.getAllEnvironmentVariables || !activeSessionId) return
    
    try {
      setLoading(true)
      const vars = await window.api.getAllEnvironmentVariables(activeSessionId)
      setEnvVars(vars)
    } catch (err) {
      setError('Failed to load environment variables')
      console.error('Error loading environment variables:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSetVariable = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      setError('Key and value cannot be empty')
      return
    }

    if (!window.api?.setEnvironmentVariable) {
      setError('API not available')
      return
    }

    try {
      setLoading(true)
      await window.api.setEnvironmentVariable(newKey, newValue, activeSessionId)
      setEnvVars(prev => ({ ...prev, [newKey]: newValue }))
      setNewKey('')
      setNewValue('')
      setError('')
    } catch (err) {
      setError('Failed to set environment variable')
      console.error('Error setting environment variable:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickSetClaudeApi = async () => {
    const baseUrl = prompt('Enter Claude API Base URL:', 'https://api.anthropic.com')
    if (!baseUrl) return

    try {
      setLoading(true)
      await window.api?.setEnvironmentVariable('ANTHROPIC_BASE_URL', baseUrl, activeSessionId)
      setEnvVars(prev => ({ ...prev, 'ANTHROPIC_BASE_URL': baseUrl }))
      setError('')
    } catch (err) {
      setError('Failed to set Claude API URL')
      console.error('Error setting Claude API URL:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickSetApiKey = async () => {
    const apiKey = prompt('Enter Anthropic API Key:')
    if (!apiKey) return

    try {
      setLoading(true)
      await window.api?.setEnvironmentVariable('ANTHROPIC_API_KEY', apiKey, activeSessionId)
      setEnvVars(prev => ({ ...prev, 'ANTHROPIC_API_KEY': apiKey }))
      setError('')
    } catch (err) {
      setError('Failed to set API key')
      console.error('Error setting API key:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStartClaudeCode = async () => {
    try {
      setLoading(true)
      await window.api?.startClaudeCode(undefined, activeSessionId)
      setError('')
    } catch (err) {
      setError('Failed to start Claude Code')
      console.error('Error starting Claude Code:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Environment Variables</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Quick Actions */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleQuickSetClaudeApi}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Set Claude API URL
              </button>
              <button
                onClick={handleQuickSetApiKey}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Set API Key
              </button>
              <button
                onClick={handleStartClaudeCode}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                Start Claude Code
              </button>
            </div>
          </div>

          {/* Add New Variable */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Add New Variable</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Variable name"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSetVariable}
                disabled={loading || !newKey.trim() || !newValue.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Current Environment Variables */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Current Environment Variables</h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(envVars).length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No environment variables found</p>
                ) : (
                  Object.entries(envVars).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{key}</div>
                        <div className="text-sm text-gray-600 truncate">
                          {key.toLowerCase().includes('key') || key.toLowerCase().includes('token') 
                            ? '*'.repeat(Math.min(value.length, 20))
                            : value}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(value)}
                          className="text-gray-400 hover:text-gray-600"
                          title="Copy value"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnvManager