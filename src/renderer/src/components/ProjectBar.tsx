import React from 'react'

const ProjectBar: React.FC = () => {
  return (
    <nav className="w-16 bg-gray-900 flex-shrink-0 flex flex-col items-center py-4 gap-4 border-r border-gray-700">
      {/* Project Icons */}
      <div 
        className="project-icon bg-blue-600 text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg cursor-pointer ring-2 ring-white" 
        title="Project 'Hydra'"
      >
        H
      </div>
      <div 
        className="project-icon bg-gray-700 hover:bg-gray-600 text-gray-300 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg cursor-pointer" 
        title="Project 'Phoenix'"
      >
        P
      </div>
      
      {/* Add New Project Button */}
      <button 
        title="Add New Project" 
        className="project-icon bg-gray-800 hover:bg-gray-700 text-gray-400 w-10 h-10 rounded-full flex items-center justify-center border-2 border-dashed border-gray-600"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
      
      <div className="w-8 border-t border-gray-700 my-2"></div>
      
      {/* All Sessions View */}
      <button 
        title="All Sessions" 
        className="project-icon bg-gray-700 hover:bg-gray-600 text-gray-300 w-10 h-10 rounded-lg flex items-center justify-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {/* Settings Button */}
      <button 
        id="settings-btn" 
        title="Settings" 
        className="mt-auto project-icon bg-gray-700 hover:bg-gray-600 text-gray-300 w-10 h-10 rounded-lg flex items-center justify-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </nav>
  )
}

export default ProjectBar