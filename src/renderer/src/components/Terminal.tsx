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

const Terminal = forwardRef<TerminalRef>((_, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  
  const { 
    setTerminalConnected, 
    setClaudeCodeRunning,
    activeSessionId 
  } = useAppStore()

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
      // Send input to main process
      if (window.api?.sendTerminalInput) {
        window.api.sendTerminalInput(data)
      } else {
        // Fallback for browser testing
        console.log('Terminal input:', data)
      }
    })

    // Listen for output from main process
    if (window.api?.onTerminalOutput) {
      window.api.onTerminalOutput((data: string) => {
        terminal.write(data)
      })
    }

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    // Write initial message based on environment
    if (window.api) {
      terminal.write('\x1b[36mCC Copilot Terminal\x1b[0m\r\n')
      terminal.write('\x1b[90mConnecting to claude-code...\x1b[0m\r\n\r\n')

      // Start claude-code process
      window.api.startClaudeCode()
        .then(() => {
          setClaudeCodeRunning(true)
          terminal.write('\x1b[32m✓ Connected to claude-code\x1b[0m\r\n\r\n')
        })
        .catch((error) => {
          setClaudeCodeRunning(false)
          terminal.write(`\x1b[31m✗ Error starting claude-code: ${error.message}\x1b[0m\r\n`)
        })
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
  }, [activeSessionId]) // Re-initialize when session changes

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