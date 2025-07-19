import React, { useRef, useEffect } from 'react'
import TabManager from './TabManager'
import { useAppStore } from '../stores/appStore'

const MainContent: React.FC = () => {
  return (
    <main className="flex-1 flex flex-col">
      {/* Tab Manager with Terminals */}
      <div className="flex-1">
        <TabManager />
      </div>
    </main>
  )
}

export default MainContent