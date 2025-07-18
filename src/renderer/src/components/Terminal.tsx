import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useAppStore } from '../stores/appStore'
import '@xterm/xterm/css/xterm.css'

export interface TerminalRef {
  clear: () => void
  focus: () => void
  write: (data: string) => void
}

interface TerminalProps {
  sessionId?: string
}

const Terminal = forwardRef<TerminalRef, TerminalProps>(({ sessionId }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  
  const { 
    setTerminalConnected, 
    setClaudeCodeRunning,
    activeSessionId 
  } = useAppStore()
  
  // Use prop sessionId if provided, otherwise fall back to store activeSessionId
  const currentSessionId = sessionId || activeSessionId

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    clear: () => {
      if (xtermRef.current) {
        xtermRef.current.clear()
      }
    },
    focus: () => {
      if (xtermRef.current) {
        xtermRef.current.focus()
      }
    },
    write: (data: string) => {
      if (xtermRef.current) {
        xtermRef.current.write(data)
      }
    }
  }), [])

  useEffect(() => {
    if (!terminalRef.current) return

    // Clear existing terminal if it exists
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
        selection: '#ffffff40',
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
    fitAddon.fit()

    // Store references
    xtermRef.current = terminal
    fitAddonRef.current = fitAddon

    // Update connection status
    setTerminalConnected(true)

    // Handle terminal input
    terminal.onData((data) => {
      // Send input to main process with session ID
      console.log('[Terminal] Sending input:', data, 'Session:', currentSessionId)
      if (window.api?.sendTerminalInput && currentSessionId) {
        window.api.sendTerminalInput(data, currentSessionId)
      } else {
        // Fallback for browser testing
        console.log('Terminal input:', data)
      }
    })

    // Listen for data from PTY process
    let dataListener: ((data: { sessionId: string; data: string } | string) => void) | null = null
    if (window.api?.onTerminalData) {
      dataListener = (data: { sessionId: string; data: string } | string) => {
        if (xtermRef.current === terminal) {
          // Handle both old format (string) and new format (with sessionId)
          if (typeof data === 'string') {
            terminal.write(data)
          } else if (data.sessionId === currentSessionId) {
            terminal.write(data.data)
          }
        }
      }
      window.api.onTerminalData(dataListener)
    }

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit()
      // Notify PTY about terminal resize
      if (window.api?.resizeTerminal && currentSessionId) {
        window.api.resizeTerminal(terminal.cols, terminal.rows, currentSessionId)
      }
    }
    window.addEventListener('resize', handleResize)

    // Write initial message based on environment
    if (window.api) {
      terminal.write('\x1b[36mCC Copilot Terminal\x1b[0m\r\n')
      terminal.write('\x1b[32m✓ Connected to PTY\x1b[0m\r\n\r\n')
      
      // Focus the terminal after initialization
      setTimeout(() => {
        terminal.focus()
        // Initial resize to match terminal size
        if (window.api?.resizeTerminal && currentSessionId) {
          window.api.resizeTerminal(terminal.cols, terminal.rows, currentSessionId)
        }
      }, 100)
    } else {
      // Browser mode - show demo content
      terminal.write('\x1b[36mCC Copilot Terminal (Demo Mode)\x1b[0m\r\n')
      terminal.write('\x1b[90mThis is a demo of the terminal interface.\x1b[0m\r\n')
      terminal.write('\x1b[90mIn the full application, this would connect to claude-code.\x1b[0m\r\n\r\n')
      terminal.write('\x1b[33mDemo commands:\x1b[0m\r\n')
      terminal.write('  • Type anything to see it echoed\r\n')
      terminal.write('  • Press Enter to see a demo response\r\n\r\n')
      terminal.write('\x1b[32m$\x1b[0m ')

      // Demo input handling for browser testing
      let currentInput = ''
      terminal.onData((data) => {
        if (data === '\r') {
          // Enter pressed
          terminal.write('\r\n')
          if (currentInput.trim()) {
            terminal.write(`\x1b[34mDemo response to: "${currentInput}"\x1b[0m\r\n`)
            terminal.write('This is how the terminal would respond in the full application.\r\n')
          }
          currentInput = ''
          terminal.write('\x1b[32m$\x1b[0m ')
        } else if (data === '\u007f') {
          // Backspace
          if (currentInput.length > 0) {
            currentInput = currentInput.slice(0, -1)
            terminal.write('\b \b')
          }
        } else if (data >= ' ') {
          // Printable character
          currentInput += data
          terminal.write(data)
        }
      })
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      setTerminalConnected(false)
      terminal.dispose()
    }
  }, [currentSessionId]) // Re-initialize when session changes

  return (
    <div 
      ref={terminalRef}
      className="h-full bg-black"
      style={{ padding: 0 }}
    />
  )
})

Terminal.displayName = 'Terminal'

export default Terminal