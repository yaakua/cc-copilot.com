import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { logger } from '../utils/logger'

interface TerminalProps {
  sessionId: string
  isActive: boolean
}

const Terminal: React.FC<TerminalProps> = ({ sessionId, isActive }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermInstanceRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // Effect for initialization and cleanup
  useEffect(() => {
    logger.setComponent('Terminal')
    logger.info('终端组件已挂载', { sessionId })

    if (!terminalRef.current) {
      logger.warn('终端容器引用尚不可用。')
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
    logger.info('xterm在容器中打开', { sessionId })

    // Initial resize
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

    // Request historical data
    if (window.api?.requestSessionData) {
      window.api.requestSessionData(sessionId)
    }

    // Welcome message
    terminal.write(`\x1b[36mCC Copilot Terminal - Session: ${sessionId}\x1b[0m\r\n`)

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