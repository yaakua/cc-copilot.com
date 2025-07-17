import React from 'react'

const SessionList: React.FC = () => {
  return (
    <aside className="w-64 flex-shrink-0 bg-gray-800 flex flex-col p-4 border-r border-gray-700">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white mb-1">Project 'Hydra'</h1>
        <p className="text-xs text-gray-400">All sessions for this project</p>
      </div>
      
      <button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        New Chat
      </button>
      
      <div className="flex-grow overflow-y-auto pr-2 -mr-2">
        <ul className="space-y-1">
          <li className="bg-blue-900/50 text-white p-2 rounded-md cursor-pointer truncate">
            API Endpoint Integration
          </li>
          <li className="hover:bg-gray-700 p-2 rounded-md cursor-pointer truncate">
            Database Schema Design
          </li>
        </ul>
      </div>
    </aside>
  )
}

export default SessionList