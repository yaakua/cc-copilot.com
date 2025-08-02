import React, { useEffect, useRef, useState } from 'react'
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
  const [bufferedData, setBufferedData] = useState<string>('')

  // Effect for data listener (always active to capture all data)
  useEffect(() => {
    logger.setComponent('Terminal')
    
    // Always initialize terminal data listener to capture all output
    const removeDataListener = window.api?.onTerminalData((eventData) => {
      if (typeof eventData === 'object' && eventData.sessionId === sessionId) {
        if (xtermInstanceRef.current) {
          // If terminal is ready, write directly
          xtermInstanceRef.current.write(eventData.data)
        } else {
          // If terminal not ready, buffer the data
          setBufferedData(prev => prev + eventData.data)
        }
      }
    })

    // Cleanup function
    return () => {
      if (removeDataListener) {
        removeDataListener()
      }
    }
  }, [sessionId])

  // Effect for terminal UI initialization (only when not loading)
  useEffect(() => {
    // Skip UI initialization if session is loading
    if (session.isLoading) {
      return
    }
    
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

    // Initialize xterm.js UI
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

    // Initial resize with multiple checks to ensure proper sizing
    setTimeout(() => fitAddon.fit(), 0)
    setTimeout(() => fitAddon.fit(), 10)
    setTimeout(() => fitAddon.fit(), 100)

    // Welcome message
    terminal.write(`\x1b[36mCC Copilot Terminal - ${session.name}\x1b[0m\r\n\r\n`)
    
    // Write any buffered data that was received while loading
    if (bufferedData) {
      terminal.write(bufferedData)
      setBufferedData('') // Clear buffer after writing
    }

    // Listen for user input
    const onDataDisposable = terminal.onData((data) => {
      window.api?.sendTerminalInput(data, sessionId)
    })

    // Cleanup on component unmount
    return () => {
      logger.info('清理终端UI组件', { sessionId })
      onDataDisposable.dispose()
      terminal.dispose()
      xtermInstanceRef.current = null
      fitAddonRef.current = null
    }
  }, [sessionId, session.isLoading, bufferedData]) // Re-run if sessionId changes or loading state changes

  // Effect for handling active state changes and resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && xtermInstanceRef.current && terminalRef.current) {
        try {
          // Ensure container has proper dimensions
          const container = terminalRef.current
          if (container.offsetWidth > 0 && container.offsetHeight > 0) {
            fitAddonRef.current.fit()
            const { cols, rows } = xtermInstanceRef.current
            window.api?.resizeTerminal(cols, rows, sessionId)
          }
        } catch (e) {
          logger.warn('窗口调整大小时终端调整失败', e as Error)
        }
      }
    }

    // Create a ResizeObserver to watch container size changes
    let resizeObserver: ResizeObserver | null = null
    if (terminalRef.current) {
      resizeObserver = new ResizeObserver(() => {
        // Use RAF to ensure DOM has updated
        requestAnimationFrame(handleResize)
      })
      resizeObserver.observe(terminalRef.current)
    }

    // Also listen for window resize events
    window.addEventListener('resize', handleResize)

    if (isActive) {
      // Focus and resize when becoming active
      xtermInstanceRef.current?.focus()
      
      // Use multiple timeouts to ensure proper sizing
      const resizeTimeout1 = setTimeout(handleResize, 10)
      const resizeTimeout2 = setTimeout(handleResize, 100)

      return () => {
        window.removeEventListener('resize', handleResize)
        resizeObserver?.disconnect()
        clearTimeout(resizeTimeout1)
        clearTimeout(resizeTimeout2)
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver?.disconnect()
    }
  }, [isActive, sessionId])

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

  return (
    <div 
      className="h-full w-full bg-black" 
      ref={terminalRef} 
      style={{ 
        height: '100%', 
        width: '100%',
        overflow: 'hidden',
        position: 'relative'
      }} 
    />
  )
}

export default Terminal