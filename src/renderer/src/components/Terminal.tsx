import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { logger } from '../utils/logger'

interface TerminalProps {
  sessionId: string
}

const Terminal: React.FC<TerminalProps> = ({ sessionId }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermInstanceRef = useRef<XTerm | null>(null)

  useEffect(() => {
    logger.setComponent('Terminal')
    logger.info('Terminal effect started', { sessionId })

    // 确保 DOM 元素已经准备好
    if (!terminalRef.current) {
      logger.warn('Terminal container ref is not available yet.')
      return
    }

    // 如果已经有终端实例，先销毁旧的，这通常在 sessionId 改变时发生
    if (xtermInstanceRef.current) {
      xtermInstanceRef.current.dispose()
      xtermInstanceRef.current = null
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
      allowProposedApi: true
    })
    
    // 保存实例到 Ref 中
    xtermInstanceRef.current = terminal

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    // 将终端挂载到 DOM
    terminal.open(terminalRef.current)
    logger.info('xterm opened in container', { sessionId })

    // 调整终端大小以适应容器
    requestAnimationFrame(() => {
      try {
        fitAddon.fit()
        logger.info('Terminal fitted to container', { sessionId })
      } catch (e) {
        logger.error('Failed to fit terminal', e as Error)
      }
    })

    // 1. 监听用户输入并发送到后端
    const onDataDisposable = terminal.onData((data) => {
      if (window.api?.sendTerminalInput) {
        window.api.sendTerminalInput(data, sessionId)
      }
    })

    // 2. 监听从后端来的数据并写入终端
    const removeDataListener = window.api?.onTerminalData((eventData: { sessionId: string; data: string }) => {
      // 确保是当前会话的数据，并且终端实例仍然存在
      if (xtermInstanceRef.current && eventData.sessionId === sessionId) {
        xtermInstanceRef.current.write(eventData.data)
      } else if (eventData.sessionId !== sessionId) {
        logger.warn('Received data for another session', {
            expected: sessionId,
            received: eventData.sessionId,
        })
      }
    })

    // 3. 监听窗口大小变化
    const handleResize = () => {
      try {
        fitAddon.fit()
        if (window.api?.resizeTerminal && terminal) {
          window.api.resizeTerminal(terminal.cols, terminal.rows, sessionId)
        }
      } catch (e) {
        logger.warn('Failed to resize terminal on window resize', e as Error)
      }
    }
    window.addEventListener('resize', handleResize)

    // 显示欢迎信息
    terminal.write('\x1b[36mCC Copilot Terminal\x1b[0m\r\n')
    terminal.write(`\x1b[32m✓ Session: ${sessionId}\x1b[0m\r\n\r\n`)

    // 聚焦并通知后端大小
    setTimeout(() => {
        terminal.focus()
        if (window.api?.resizeTerminal) {
            window.api.resizeTerminal(terminal.cols, terminal.rows, sessionId)
        }
        // 请求该会话可能存在的历史缓冲数据
        if ((window.api as any)?.requestSessionData) {
            (window.api as any).requestSessionData(sessionId)
        }
    }, 100)

    // 清理函数
    return () => {
      logger.info('Cleaning up terminal effect', { sessionId })
      window.removeEventListener('resize', handleResize)
      onDataDisposable.dispose()
      if (removeDataListener) {
        removeDataListener()
      }
      // 销毁终端实例
      if (xtermInstanceRef.current) {
        xtermInstanceRef.current.dispose()
        xtermInstanceRef.current = null
      }
    }
  }, [sessionId]) // 依赖项只有 sessionId，确保会话切换时能重建终端

  // 始终渲染终端的容器，useEffect 会负责将 xterm 实例填入
  return (
    <div className="h-full bg-black">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  )
}

export default Terminal