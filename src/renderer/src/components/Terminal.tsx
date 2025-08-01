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

    // 粘贴事件支持
    // terminal.onPaste((data) => {
    //   window.api?.sendTerminalInput(data, sessionId)
    //   return false // 阻止默认行为
    // })


    // 手动处理粘贴事件
    document.addEventListener('paste', (event) => {
      if (document.activeElement === terminal.element ||
        terminal.element?.contains(document.activeElement)) {
        event.preventDefault();
        const text = event.clipboardData?.getData('text');
        if (text) {
          terminal.paste(text);
        }
      }
    });

    // 处理右键粘贴（可选）
    terminal.element?.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      // 可以显示自定义右键菜单
    });

    // 确保键盘快捷键工作
    terminal.attachCustomKeyEventHandler((event) => {

      if (event.type === 'keydown' && (event.ctrlKey || event.metaKey) && event.key === 'c') {
        if (terminal.hasSelection()) {
          // 有选择时复制
          event.preventDefault();
          copyToClipboard();
          return false;
        }
      }
      if (event.type === 'keydown' && (event.ctrlKey || event.metaKey) && event.key === 'v') {
        // Ctrl+V 或 Cmd+V
        navigator.clipboard.readText().then(text => {
          // terminal.paste(text);
        }).catch(err => {
          console.log('无法读取剪贴板:', err);
        });
        return false; // 阻止默认处理
      }
      if (event.type === 'keydown' && (event.ctrlKey || event.metaKey) && event.key === 'a') {
        terminal.selectAll();
        return false; // 阻止默认处理
      }
      return true;
    });


    // 粘贴事件支持（监听外层div）
    const handlePaste = () => {
      // const text = e.clipboardData?.getData('text')
      // if (text) {
      //   window.api?.sendTerminalInput(text, sessionId)
      //   e.preventDefault()
      // }
      navigator.clipboard.readText().then(text => {
        terminal.paste(text);
      }).catch(err => {
        console.log('无法读取剪贴板:', err);
      });
    } 
    // container?.addEventListener('paste', handlePaste)

    // 方法1: 使用现代 Clipboard API
    async function copyToClipboard() {
      const selection = terminal.getSelection();
      if (selection) {
        try {
          await navigator.clipboard.writeText(selection);
          console.log('已复制到剪贴板');
        } catch (err) {
          console.error('复制失败:', err);
          // 降级到传统方法
          fallbackCopy(selection);
        }
      }
    }

    // 方法2: 传统复制方法（兼容性更好）
    function fallbackCopy(text: string) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        console.log('已复制到剪贴板');
      } catch (err) {
        console.error('复制失败:', err);
      }

      document.body.removeChild(textArea);
    }

    // 创建右键菜单
    function createContextMenu() {
      const menu = document.createElement('div');
      menu.id = 'terminal-context-menu';
      menu.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 5px 0;
      box-shadow: 2px 2px 10px rgba(0,0,0,0.1);
      z-index: 1000;
      display: none;
      color: #000;
  `;

      const copyItem = document.createElement('div');
      copyItem.textContent = '复制';
      copyItem.style.cssText = 'padding: 5px 15px; cursor: pointer;';
      copyItem.onclick = () => {
        copyToClipboard();
        hideContextMenu();
      };

      const pasteItem = document.createElement('div');
      pasteItem.textContent = '粘贴';
      pasteItem.style.cssText = 'padding: 5px 15px; cursor: pointer;';
      pasteItem.onclick = () => {
        handlePaste();
        hideContextMenu();
      };

      menu.appendChild(copyItem);
      menu.appendChild(pasteItem);
      document.body.appendChild(menu);

      return menu;
    }

    const contextMenu = createContextMenu();

    // 显示右键菜单
    function showContextMenu(x: number, y: number) {
      contextMenu.style.left = x + 'px';
      contextMenu.style.top = y + 'px';
      contextMenu.style.display = 'block';
    }

    // 隐藏右键菜单
    function hideContextMenu() {
      contextMenu.style.display = 'none';
    }

    // 监听右键事件
    terminal.element?.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      showContextMenu(event.clientX, event.clientY);
    });

    // 点击其他地方隐藏菜单
    document.addEventListener('click', () => {
      hideContextMenu();
    });

    // Initial resize with multiple checks
    fitAddon.fit()

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
    <div className="h-full w-full bg-black" ref={terminalRef} />
  )
}

export default Terminal