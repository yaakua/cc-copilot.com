import React from 'react'

const StatusBar: React.FC = () => {
  return (
    <div className="flex-shrink-0 h-20 bg-gray-800 border-t border-gray-700 px-6 flex items-center justify-between">
      {/* Left: Status */}
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
        <span className="font-medium text-green-400">Running</span>
      </div>

      {/* Center: Usage Stats with Scope Selector */}
      <div className="flex items-center gap-8">
        {/* Scope Selector */}
        <div className="relative group">
          <button className="text-xs uppercase font-bold text-gray-400 hover:text-white flex items-center gap-1">
            Current Session
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="absolute bottom-full mb-2 w-32 bg-gray-700 rounded-md shadow-lg hidden group-hover:block">
            <a href="#" className="block px-3 py-2 text-sm text-white bg-gray-800">Current Session</a>
            <a href="#" className="block px-3 py-2 text-sm text-gray-300 hover:bg-gray-600">Project 'Hydra'</a>
            <a href="#" className="block px-3 py-2 text-sm text-gray-300 hover:bg-gray-600">Global</a>
          </div>
        </div>
        
        {/* Stats Display */}
        <div className="text-center">
          <div className="text-xl font-semibold text-cyan-400">89</div>
          <div className="text-xs text-gray-400">PROMPT</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-cyan-400">210</div>
          <div className="text-xs text-gray-400">COMPLETION</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-cyan-400">299</div>
          <div className="text-xs text-gray-400">TOTAL</div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
          Stop
        </button>
        <button className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
          Clear
        </button>
      </div>
    </div>
  )
}

export default StatusBar