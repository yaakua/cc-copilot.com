import React, { useState } from 'react'

const SettingsModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  const handleSave = () => {
    console.log('Settings saved!')
    setIsOpen(false)
  }

  return (
    <>
      {/* Modal */}
      <div className={`fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 ${isOpen ? '' : 'hidden'}`}>
        <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <h2 className="text-2xl font-bold text-white mb-6 p-6 flex-shrink-0 border-b border-gray-700">Settings</h2>
          
          <div className="p-6 overflow-y-auto">
            <div className="space-y-8">
              {/* API Providers Section */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">API Providers</h3>
                <div className="space-y-4">
                  {/* Example Provider 1 */}
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-cyan-400">Groq API</span>
                      <button className="text-xs text-red-400 hover:underline">Remove</button>
                    </div>
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-1 text-sm" 
                        defaultValue="https://api.groq.com/openai/v1"
                      />
                      <input 
                        type="password" 
                        className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-1 text-sm" 
                        defaultValue="gsk_placeholder"
                      />
                    </div>
                  </div>
                  
                  {/* Example Provider 2 */}
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-purple-400">Moonshot API</span>
                      <button className="text-xs text-red-400 hover:underline">Remove</button>
                    </div>
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-1 text-sm" 
                        defaultValue="https://api.moonshot.cn/v1"
                      />
                      <input 
                        type="password" 
                        className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-1 text-sm" 
                        defaultValue="sk-placeholder"
                      />
                    </div>
                  </div>
                  
                  <button className="w-full text-sm bg-gray-600 hover:bg-gray-500 py-2 rounded-md">
                    + Add New Provider
                  </button>
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
                      className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-md px-3 py-2 text-sm" 
                      placeholder="http://127.0.0.1:7890"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto p-6 flex-shrink-0 flex justify-end gap-4 border-t border-gray-700">
            <button 
              onClick={() => setIsOpen(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default SettingsModal