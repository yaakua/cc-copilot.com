import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { logger } from '../utils/logger'

interface TerminalProps {
  sessionId: string
}

const Terminal: React.FC<TerminalProps> = ({ sessionId }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    logger.setComponent('Terminal')
    if (!terminalRef.current) return

    // Clean up existing terminal
    if (xtermRef.current) {
      xtermRef.current.dispose()
    }

    // Initialize xterm.js
    const terminal = new XTerm({
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#819cd8',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff'
      },
      fontFamily: 'SF Mono, Monaco, Cascadia Code, Roboto Mono, Consolas, Courier New, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      rows: 30,
      cols: 80,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(terminalRef.current)

    // Store references
    xtermRef.current = terminal
    fitAddonRef.current = fitAddon

    // Fit terminal to container
    setTimeout(() => {
      try {
        fitAddon.fit()
        setIsConnected(true)
      } catch (error) {
        logger.warn('Failed to fit terminal', error as Error)
      }
    }, 0)

    // Handle terminal input
    terminal.onData((data) => {
      if (window.api?.sendTerminalInput) {
        window.api.sendTerminalInput(data, sessionId)
      }
    })

    // Listen for terminal output
    let removeListener: (() => void) | undefined
    if (window.api?.onTerminalData) {
      const dataListener = (data: { sessionId: string; data: string } | string) => {
        logger.info('Received terminal data', { data, sessionId, currentSessionId: sessionId })
        console.log('Terminal component received data:', data, 'for session:', sessionId)
        if (xtermRef.current === terminal) {
          if (typeof data === 'string') {
            terminal.write(data)
          } else if (data.sessionId === sessionId) {
            logger.info('Writing data to terminal', { dataLength: data.data.length })
            terminal.write(data.data)
          } else {
            logger.warn('Data sessionId mismatch', { 
              receivedSessionId: data.sessionId, 
              expectedSessionId: sessionId 
            })
          }
        }
      }
      removeListener = window.api.onTerminalData(dataListener)
      logger.info('Terminal data listener registered', { sessionId })
      console.log('Terminal data listener registered for session:', sessionId)
    }

    // Handle window resize
    const handleResize = () => {
      try {
        fitAddon.fit()
        if (window.api?.resizeTerminal) {
          window.api.resizeTerminal(terminal.cols, terminal.rows, sessionId)
        }
      } catch (error) {
        logger.warn('Failed to resize terminal', error as Error)
      }
    }
    window.addEventListener('resize', handleResize)

    // Show connection message
    terminal.write('\x1b[36mCC Copilot Terminal\x1b[0m\r\n')
    terminal.write(`\x1b[32m✓ Session: ${sessionId}\x1b[0m\r\n\r\n`)

    // Focus terminal
    setTimeout(() => {
      terminal.focus()
      if (window.api?.resizeTerminal) {
        window.api.resizeTerminal(terminal.cols, terminal.rows, sessionId)
      }
    }, 100)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (removeListener) {
        removeListener()
      }
      terminal.dispose()
    }
  }, [sessionId])

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <div>Connecting to terminal...</div>
      </div>
    )
  }

  return (
    <div className="h-full bg-black">
      <div ref={terminalRef} className="h-full w-full p-4" />
    </div>
  )
}

export default Terminal