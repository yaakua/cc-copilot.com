import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { logger } from '../utils/logger'
import { Session } from '../../../shared/types'
interface TerminalProps {
  sessionId: string
  isActive: boolean
  session: Session
}

const Terminal: React.FC<TerminalProps> = ({ sessionId, isActive, session }) => {
  const { t } = useTranslation()
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermInstanceRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // Show loading state if session is loading
  if (session.isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-black">
        <div className="text-center" style={{ color: 'var(--text-secondary)' }}>
          <div className="mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
          <div className="text-lg font-medium mb-2">
            {session.isTemporary ? t('sessions.creating') : t('common.loading')}
          </div>
          <div className="text-sm opacity-70">
            {t('sessions.session')}: {session.name}
          </div>
        </div>
      </div>
    )
  }

  // Effect for initialization and cleanup
  useEffect(() => {
    logger.setComponent('Terminal')
    if (!terminalRef.current) {
      logger.warn('终端容器引用尚不可用。')
      return
    }

    // Ensure container has dimensions before initializing
    const container = terminalRef.current
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      logger.warn('终端容器尺寸为0，等待下一次渲染')
      return
    }

    // Initialize xterm.js only once
    const terminal = new XTerm({
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
        // ... (theme properties)
      },
      fontFamily: 'SF Mono, Monaco, Cascadia Code, Roboto Mono, Consolas, Courier New, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    xtermInstanceRef.current = terminal
    fitAddonRef.current = fitAddon

    terminal.open(terminalRef.current)

    // Initial resize with multiple checks
    fitAddon.fit()

    // Listen for user input
    const onDataDisposable = terminal.onData((data) => {
      window.api?.sendTerminalInput(data, sessionId)
    })

    // Listen for data from backend
    const removeDataListener = window.api?.onTerminalData((eventData) => {
      if (typeof eventData === 'object' && xtermInstanceRef.current && eventData.sessionId === sessionId) {
        xtermInstanceRef.current.write(eventData.data)
      }
    })
   
    // Welcome message
    terminal.write(`\x1b[36mCC Copilot Terminal - ${session.name}\x1b[0m\r\n\r\n`)

    // Cleanup on component unmount
    return () => {
      logger.info('清理终端组件', { sessionId })
      onDataDisposable.dispose()
      if (removeDataListener) {
        removeDataListener()
      }
      terminal.dispose()
      xtermInstanceRef.current = null
      fitAddonRef.current = null
    }
  }, [sessionId]) // Re-run only if sessionId changes (new tab)

  // Effect for handling active state changes and resize
  useEffect(() => {
    const handleResize = () => {
      if (isActive && fitAddonRef.current && xtermInstanceRef.current) {
        try {
          fitAddonRef.current.fit()
          const { cols, rows } = xtermInstanceRef.current
          window.api?.resizeTerminal(cols, rows, sessionId)
        } catch (e) {
          logger.warn('窗口调整大小时终端调整失败', e as Error)
        }
      }
    }

    if (isActive) {
      // Focus and resize when becoming active
      xtermInstanceRef.current?.focus()
      handleResize() // Initial fit for active tab
      window.addEventListener('resize', handleResize)
    } else {
      window.removeEventListener('resize', handleResize)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [isActive, sessionId])

  return (
    <div className="h-full w-full bg-black" ref={terminalRef} />
  )
}

export default Terminal