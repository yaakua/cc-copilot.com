import React from 'react'
import Terminal from './Terminal'
import StatusBar from './StatusBar'

const MainContent: React.FC = () => {
  return (
    <main className="flex-grow flex flex-col">
      {/* Session Info Bar */}
      <div className="flex-shrink-0 bg-gray-800/50 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <h2 className="font-semibold text-white">API Endpoint Integration</h2>
        <div className="relative group">
          <button className="flex items-center gap-2 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-md">
            <span className="font-mono text-cyan-400">Groq Llama3</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg hidden group-hover:block z-10">
            <a href="#" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600">Moonshot Kimi</a>
            <a href="#" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600">OpenAI GPT-4o</a>
            <a href="#" className="block px-4 py-2 text-sm text-cyan-400 font-bold bg-gray-800">Groq Llama3</a>
          </div>
        </div>
      </div>

      {/* Terminal Area */}
      <div className="flex-grow">
        <Terminal />
      </div>

      {/* Status and Stats Bar */}
      <StatusBar />
    </main>
  )
}

export default MainContent