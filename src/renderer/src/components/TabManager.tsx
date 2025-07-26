import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Terminal from './Terminal'
import { Session, Project } from '../../../shared/types'

interface TabInfo {
  sessionId: string
  session: Session
  isActive: boolean
}

interface TabManagerProps {
  projects: Project[]
  activeSessionIds: string[]
  currentActiveSessionId: string | null
  onActivateSession: (sessionId: string) => void
  onCloseTab: (sessionId: string) => void
}

const TabManager: React.FC<TabManagerProps> = ({
  projects,
  activeSessionIds,
  currentActiveSessionId,
  onActivateSession,
  onCloseTab
}) => {
  const { t } = useTranslation()
  const [tabs, setTabs] = useState<TabInfo[]>([])

  useEffect(() => {
    const newTabs: TabInfo[] = []
    
    for (const sessionId of activeSessionIds) {
      let session: Session | undefined
      
      // Find session in projects
      for (const project of projects) {
        session = project.sessions.find(s => s.id === sessionId)
        if (session) break
      }
      
      if (session) {
        newTabs.push({
          sessionId,
          session,
          isActive: sessionId === currentActiveSessionId
        })
      }
    }
    
    setTabs(newTabs)
  }, [activeSessionIds, currentActiveSessionId, projects])

  const handleTabClick = (sessionId: string) => {
    onActivateSession(sessionId)
  }

  const handleCloseTab = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    onCloseTab(sessionId)
  }

  const getSessionDisplayName = (session: Session) => {
    const project = projects.find(p => p.id === session.projectId)
    const projectName = project?.name || t('common.unknown')
    return `${projectName} - ${session.name}`
  }



  if (tabs.length === 0) {
    return (
      <WelcomeScreen />
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 flex flex-col min-h-0">
        {/* Tab Bar */}
        <div className="flex-shrink-0">
          <div className="flex items-end" style={{ borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-sidebar)' }}>
            {tabs.map((tab) => (
              <div
                key={tab.sessionId}
                onClick={() => handleTabClick(tab.sessionId)}
                className={`flex items-center gap-2 px-4 py-2.5 border-b-2 cursor-pointer transition-colors ${
                  tab.isActive ? 'tab-item-active' : ''
                }`}
                style={{
                  backgroundColor: tab.isActive ? 'var(--bg-primary)' : 'transparent',
                  color: tab.isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderBottomColor: tab.isActive ? 'var(--accent)' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (!tab.isActive) {
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!tab.isActive) {
                    e.currentTarget.style.color = 'var(--text-tertiary)'
                  }
                }}
              >
                <span className="terminal-font text-sm truncate max-w-[200px]">
                  {getSessionDisplayName(tab.session)}
                </span>
                <button
                  onClick={(e) => handleCloseTab(e, tab.sessionId)}
                  className="ml-1 opacity-0 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                  title={t('common.close')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Terminal Content */}
        <div className="flex-grow p-4 terminal-font overflow-y-auto" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
          {tabs.map((tab) => (
            <div
              key={tab.sessionId}
              className={`h-full w-full ${tab.isActive ? 'block' : 'hidden'}`}
            >
              <Terminal sessionId={tab.sessionId} isActive={tab.isActive} session={tab.session} />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

const RocketIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" >
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.33-.04-3.08.69-.13 1.42-.26 2.12-.45.51-.13 1.02-.29 1.5-.45.5-.17.99-.34 1.48-.51l3.5-1.5c.33-.14.65-.28.96-.43.31-.15.6-.29.88-.45s.55-.31.81-.49c.26-.18.5-.34.73-.51.46-.34.88-.77 1.22-1.27.34-.5.58-1.1.7-1.72.12-.62.1-1.28-.05-1.92s-.4-1.23-.77-1.76c-.37-.53-.8-1-1.28-1.4s-1.03-.7-1.63-1.02c-.6-.32-1.23-.56-1.88-.73s-1.3-.25-1.95-.25c-.65 0-1.3.1-1.93.3s-1.23.47-1.8.81c-.57.34-1.1.75-1.57 1.22s-.88.98-1.22 1.53c-.34.55-.6 1.13-.77 1.73s-.25 1.2-.25 1.8c0 .88.2 1.73.52 2.52.32.79.75 1.51 1.28 2.15.53.64 1.13 1.2 1.8 1.65.66.45 1.38.82 2.13 1.1.75.28 1.5.46 2.25.56.25.03.5.06.74.08.25.03.49.04.74.05.74.05 1.48.01 2.2-.08.72-.09 1.43-.25 2.12-.47" />
  </svg>
);

const TargetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
    </svg>
);

const HelpCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);


export const WelcomeScreen = () => {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-8" style={{ color: 'var(--text-tertiary)' }}>
      <div className="w-full max-w-3xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('welcome.title')}
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            {t('welcome.subtitle')}
          </p>
        </div>

        {/* Quick Start Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl shadow-lg">
          <div className="p-6">
            <h3 className="flex items-center gap-3 text-xl font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
              <RocketIcon />
              {t('welcome.quickStart')}
            </h3>
            <div className="space-y-4 text-left">
              <p>{t('welcome.step1')}</p>
              <p>{t('welcome.step2')}</p>
              <p>{t('welcome.step3')}</p>
            </div>
          </div>
        </div>

        {/* Core Features & FAQ Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Core Features Card */}
            <div className="bg-white/5 border border-white/10 rounded-xl shadow-lg p-6">
                <h3 className="flex items-center gap-3 text-xl font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
                    <TargetIcon />
                    {t('welcome.features')}
                </h3>
                <div className="space-y-5 text-left">
                    <div>
                        <h4 className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{t('welcome.feature1')}</h4>
                        <p className="text-sm">{t('welcome.feature2')}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{t('welcome.feature3')}</h4>
                        <p className="text-sm">{t('welcome.feature4')}</p>
                    </div>
                </div>
            </div>

            {/* FAQ Card */}
            <div className="bg-white/5 border border-white/10 rounded-xl shadow-lg p-6">
                <h3 className="flex items-center gap-3 text-xl font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
                    <HelpCircleIcon />
                    {t('welcome.faq')}
                </h3>
                <div className="space-y-4 text-left">
                    <div>
                        <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('welcome.faq1')}</p>
                        <p className="text-sm">{t('welcome.faq1Answer')}</p>
                    </div>
                    <div>
                        <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('welcome.faq2')}</p>
                        <p className="text-sm">{t('welcome.faq2Answer')}</p>
                    </div>
                    <div>
                        <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('welcome.faq3')}</p>
                        <p className="text-sm">{t('welcome.faq3Answer')}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer Call to Action */}
        <p className="text-center text-sm opacity-80 pt-4">
          从左侧面板选择已有会话或创建新项目开始使用
        </p>
      </div>
    </div>
  );
};

export default TabManager