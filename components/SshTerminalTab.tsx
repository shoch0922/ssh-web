/**
 * SSH Terminal Tab Component
 *
 * Single terminal instance component extracted from SshTerminal.tsx
 * Prop-driven for use in multi-tab environment
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import VirtualKeyboard from './VirtualKeyboard';
import { SshTerminalTabProps, ConnectionState } from '@/types/ssh';

export default function SshTerminalTab({
  session,
  isActive,
  onSessionUpdate,
  onSessionError,
}: SshTerminalTabProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isIntentionalDisconnectRef = useRef(false);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string>(session.tmuxSessionId);
  const currentDirectoryRef = useRef<string>('');
  const absolutePathRef = useRef<string>('');

  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000; // 2 seconds

  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState('');
  const [currentDirectory, setCurrentDirectory] = useState<string>('');

  // Update sessionIdRef when session.tmuxSessionId changes
  useEffect(() => {
    sessionIdRef.current = session.tmuxSessionId;
  }, [session.tmuxSessionId]);

  // Update parent component about connection state
  useEffect(() => {
    onSessionUpdate({
      id: session.id,
      lastAccessedAt: new Date().toISOString(),
    });
  }, [connectionState, session.id, onSessionUpdate]);

  // Virtual keyboard input handler
  const handleVirtualKeyPress = (key: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: key }));
    }
  };

  // Focus terminal
  const focusTerminal = () => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.focus();
    } else if (terminalRef.current) {
      const terminalElement = terminalRef.current.querySelector('.xterm');
      if (terminalElement) {
        (terminalElement as HTMLElement).focus();
      } else {
        terminalRef.current.focus();
      }
    }
  };

  // WebSocket connection function
  const connectWebSocket = (term: Terminal, fitAddon: FitAddon): WebSocket => {
    isIntentionalDisconnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // WebSocket URL configuration
    const websocketHost = process.env.NEXT_PUBLIC_WEBSOCKET_HOST || window.location.hostname;
    const websocketPort = process.env.NEXT_PUBLIC_WEBSOCKET_PORT || '3001';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // URL構築: NEXT_PUBLIC_WEBSOCKET_HOSTが設定されている場合でも、ポートが明示的に指定されていない場合はデフォルトポートを使用
    let websocketUrl: string;
    if (process.env.NEXT_PUBLIC_WEBSOCKET_HOST) {
      // ホスト名にポートが含まれているかチェック
	  websocketUrl = `${protocol}//${websocketHost}`;
    } else {
      websocketUrl = `${protocol}//${websocketHost}:${websocketPort}`;
    }

    console.log(
      `[SSH Terminal Tab] Connecting to ${websocketUrl} (attempt ${reconnectAttemptsRef.current + 1}, ` +
      `sessionId: ${session.id}, tab: ${session.name}, ` +
      `host: ${websocketHost}, port: ${websocketPort}, protocol: ${protocol})`
    );

    setConnectionState('connecting');
    
    let websocket: WebSocket;
    try {
      websocket = new WebSocket(websocketUrl);
    } catch (error) {
      console.error(`[SSH Terminal Tab] Failed to create WebSocket for session ${session.id}:`, error);
      setConnectionState('error');
      setError('WebSocket接続の作成に失敗しました');
      onSessionError(session.id, `WebSocket creation failed: ${error}`);
      // 再接続を試みる
      attemptReconnect(term, fitAddon);
      // ダミーのWebSocketを返す（実際には使用されない）
      return {} as WebSocket;
    }

    // Connection timeout
    const connectionTimeout = setTimeout(() => {
      if (websocket.readyState !== WebSocket.OPEN) {
        console.error(`[SSH Terminal Tab] Connection timeout for session ${session.id}`);
        websocket.close();
        setConnectionState('error');
        setError('Connection timeout');
        attemptReconnect(term, fitAddon);
      }
    }, 5000);

    websocket.onopen = () => {
      console.log(`[SSH Terminal Tab] WebSocket connected for session ${session.id}`);
      clearTimeout(connectionTimeout);
      setConnectionState('connected');
      setError('');
      reconnectAttemptsRef.current = 0;

      // Send init message with session ID (use ref to get latest value)
      websocket.send(
        JSON.stringify({
          type: 'init',
          sessionId: sessionIdRef.current,
        })
      );
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'session_info') {
          console.log(
            `[SSH Terminal Tab] Session ${message.isNewSession ? 'created' : 'restored'}: ` +
            `${message.sessionId} (tmux: ${message.tmuxAvailable ? 'available' : 'unavailable'})`
          );

          // サーバーから返されたセッションIDをセッションストアに保存
          if (message.sessionId && message.sessionId !== session.tmuxSessionId) {
            console.log(
              `[SSH Terminal Tab] Updating tmuxSessionId from ${session.tmuxSessionId} to ${message.sessionId}`
            );
            onSessionUpdate({
              id: session.id,
              tmuxSessionId: message.sessionId,
            });
          }

          // 初回接続時にコンテナサイズに合わせてリサイズ
          setTimeout(() => {
            fitAddon.fit();
            if (websocket.readyState === WebSocket.OPEN) {
              websocket.send(
                JSON.stringify({
                  type: 'resize',
                  cols: term.cols,
                  rows: term.rows,
                })
              );
              console.log(
                `[SSH Terminal Tab] Initial resize sent: ${term.cols}x${term.rows}`
              );
            }
          }, 100);
        } else if (message.type === 'output') {
          term.write(message.data);
        } else if (message.type === 'error') {
          console.error('[SSH Terminal Tab] Server error:', message.message);
          setError(message.message);
          setConnectionState('error');
        } else if (message.type === 'current_directory') {
          // サーバーから送信された現在のディレクトリを処理
          const dir = message.directory;
          const basePath = process.env.NEXT_PUBLIC_FILE_MANAGER_BASE_PATH || '/home/shoch0922';

          // 絶対パスと相対パスを計算
          let relativeDir = dir;
          if (dir.startsWith(basePath)) {
            relativeDir = '~' + dir.slice(basePath.length);
            if (relativeDir === '~') {
              relativeDir = '~';
            }
          }

          // 状態が変わった場合のみ更新
          if (dir !== absolutePathRef.current) {
            absolutePathRef.current = dir;
            currentDirectoryRef.current = relativeDir;
            setCurrentDirectory(relativeDir);

            // セッション情報を更新
            onSessionUpdate({
              id: session.id,
              currentDirectory: relativeDir,
              absolutePath: dir,
            } as any);
          }
        }
      } catch (err) {
        console.error(`[SSH Terminal Tab] Failed to parse message for session ${session.id}:`, err);
      }
    };

    websocket.onclose = (event) => {
      clearTimeout(connectionTimeout);
      
      if (isIntentionalDisconnectRef.current) {
        console.log(`[SSH Terminal Tab] WebSocket closed intentionally for session ${session.id}`);
        setConnectionState('disconnected');
        return;
      }

      // エラーコードの詳細をログに出力
      const closeInfo = {
        code: event.code,
        reason: event.reason || 'No reason provided',
        wasClean: event.wasClean,
        sessionId: session.id,
        tmuxSessionId: session.tmuxSessionId,
      };

      // エラーコードに応じたメッセージ
      let errorMessage = '';
      if (event.code === 1006) {
        errorMessage = '接続が異常終了しました（サーバーに接続できません）';
        console.error(
          `[SSH Terminal Tab] WebSocket connection failed for session ${session.id}:`,
          {
            ...closeInfo,
            url: websocketUrl,
            possibleCauses: [
              'WebSocketサーバーが起動していない可能性があります',
              'ポート番号が間違っている可能性があります',
              'ネットワーク接続に問題がある可能性があります',
              'ファイアウォールが接続をブロックしている可能性があります',
            ],
          }
        );
      } else if (event.code === 1000) {
        console.log(`[SSH Terminal Tab] WebSocket closed normally for session ${session.id}:`, closeInfo);
      } else {
        errorMessage = `接続が切断されました (コード: ${event.code})`;
        console.warn(
          `[SSH Terminal Tab] WebSocket closed unexpectedly for session ${session.id}:`,
          { ...closeInfo, url: websocketUrl }
        );
      }

      setConnectionState('disconnected');
      if (errorMessage) {
        setError(errorMessage);
      }

      // Attempt reconnect if not intentional and not a normal closure
      if (event.code !== 1000) {
        attemptReconnect(term, fitAddon);
      }
    };

    websocket.onerror = (error) => {
      // WebSocketのonerrorイベントは詳細情報が少ないため、警告レベルのログに変更
      // 実際のエラー詳細はoncloseイベントで取得できる
      if (!isIntentionalDisconnectRef.current) {
        console.warn(
          `[SSH Terminal Tab] WebSocket error event for session ${session.id} ` +
          `(URL: ${websocketUrl}, readyState: ${websocket.readyState}, details will be in onclose event)`
        );
        // 接続前のエラー（readyState === CONNECTING）の場合は、エラー状態を設定
        if (websocket.readyState === WebSocket.CONNECTING) {
          setConnectionState('error');
          setError('WebSocket接続エラーが発生しました');
        }
      }
      clearTimeout(connectionTimeout);
    };

    // Send terminal input to WebSocket
    const sendInput = (data: string) => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'input', data }));
      }
    };

    term.onData((data) => {
      sendInput(data);
    });

    // Resize event handler with debounce
    let resizeTimeout: NodeJS.Timeout | null = null;
    const handleResize = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
          fitAddon.fit();
          if (websocket.readyState === WebSocket.OPEN) {
            websocket.send(
              JSON.stringify({
                type: 'resize',
                cols: term.cols,
                rows: term.rows,
              })
            );
          }
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    // Store cleanup function
    (websocket as any).cleanup = () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      clearTimeout(connectionTimeout);
    };

    wsRef.current = websocket;
    setWs(websocket);

    return websocket;
  };

  // Reconnection attempt function
  const attemptReconnect = (term: Terminal, fitAddon: FitAddon) => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log(`[SSH Terminal Tab] Max reconnect attempts reached for session ${session.id}`);
      setError(
        `接続が切断されました。再接続を${maxReconnectAttempts}回試みましたが失敗しました。` +
        `タブを閉じて新しいタブを開いてください。`
      );
      setConnectionState('error');
      onSessionError(
        session.id,
        `Max reconnection attempts (${maxReconnectAttempts}) reached`
      );
      return;
    }

    setConnectionState('reconnecting');
    setError(
      `接続が切断されました。再接続を試みています... ` +
      `(${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`
    );

    reconnectAttemptsRef.current += 1;

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(
        `[SSH Terminal Tab] Attempting to reconnect for session ${session.id} ` +
        `(${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
      );

      // Cleanup old WebSocket
      if (wsRef.current) {
        if ((wsRef.current as any).cleanup) {
          (wsRef.current as any).cleanup();
        }
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close();
        }
      }

      // Attempt new connection
      connectWebSocket(term, fitAddon);
    }, reconnectDelay);
  };

  // Initialize terminal (only when active)
  useEffect(() => {
    if (!isActive || !terminalRef.current) return;

    console.log(`[SSH Terminal Tab] Initializing terminal for session ${session.id}`);

    // Initialize xterm.js terminal
    const isMobile = window.innerWidth < 768;
    const term = new Terminal({
      cursorBlink: true,
      fontSize: isMobile ? 11 : 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
      scrollback: 50000, // Increase scrollback buffer to 50000 lines (default is 1000)
      allowTransparency: false, // Ensure proper rendering
      scrollOnUserInput: true, // Scroll to bottom on input
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(terminalRef.current);

    setTerminal(term);
    terminalInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    // Delay initial fit to avoid layout shift
    // Wait for all layout calculations to complete
    const initialFitTimeout = setTimeout(() => {
      if (fitAddonRef.current && terminalContainerRef.current && terminalInstanceRef.current) {
        const rect = terminalContainerRef.current.getBoundingClientRect();
        console.log(`[SSH Terminal Tab] Container size before fit: ${rect.width}x${rect.height}`);
        fitAddonRef.current.fit();
        console.log(`[SSH Terminal Tab] Initial fit complete for session ${session.id}, terminal size: ${terminalInstanceRef.current.cols}x${terminalInstanceRef.current.rows}`);
      }
    }, 300);

    // Setup ResizeObserver for automatic resizing
    const resizeObserver = new ResizeObserver((entries) => {
      if (fitAddonRef.current && terminalInstanceRef.current) {
        // Add small delay to ensure layout is stable
        requestAnimationFrame(() => {
          if (fitAddonRef.current && terminalInstanceRef.current) {
            const entry = entries[0];
            const { width, height } = entry.contentRect;
            console.log(`[SSH Terminal Tab] ResizeObserver: container size ${width}x${height}`);
            fitAddonRef.current.fit();
            console.log(`[SSH Terminal Tab] ResizeObserver triggered fit for session ${session.id}, terminal size: ${terminalInstanceRef.current.cols}x${terminalInstanceRef.current.rows}`);
          }
        });
      }
    });

    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }

    // Establish WebSocket connection
    const websocket = connectWebSocket(term, fitAddon);

    // Cleanup function
    return () => {
      console.log(`[SSH Terminal Tab] Cleaning up terminal for session ${session.id}`);
      isIntentionalDisconnectRef.current = true;

      // Clear initial fit timeout
      clearTimeout(initialFitTimeout);

      // Disconnect ResizeObserver
      resizeObserver.disconnect();

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      const currentWs = wsRef.current;
      if (currentWs) {
        if ((currentWs as any).cleanup) {
          (currentWs as any).cleanup();
        }

        // Remove event handlers before closing
        currentWs.onclose = null;
        currentWs.onerror = null;
        currentWs.onmessage = null;
        currentWs.onopen = null;

        if (
          currentWs.readyState === WebSocket.OPEN ||
          currentWs.readyState === WebSocket.CONNECTING
        ) {
          currentWs.close(1000); // Normal closure
        }
      }

      wsRef.current = null;
      terminalInstanceRef.current = null;
      fitAddonRef.current = null;

      term.dispose();
      setTerminal(null);
    };
  }, [isActive, session.id]);

  // Refit terminal when becoming active
  useEffect(() => {
    if (isActive && terminal && fitAddonRef.current) {
      // Delay to avoid layout shift when switching tabs
      const refitTimeout = setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          console.log(`[SSH Terminal Tab] Refit on active for session ${session.id}`);
        }
      }, 150);

      return () => clearTimeout(refitTimeout);
    }
  }, [isActive, terminal, session.id]);

  const isConnected = connectionState === 'connected';
  const isReconnecting = connectionState === 'reconnecting';

  // Expose insertPath function to parent via ref (we'll use a callback prop instead)
  const insertPathToTerminal = useCallback((path: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Escape spaces and special characters in path
      const escapedPath = path.replace(/(\s)/g, '\\$1');
      wsRef.current.send(JSON.stringify({ type: 'input', data: escapedPath }));
    }
  }, []);

  // Send command to terminal (for code-server launch, etc.)
  const sendCommandToTerminal = useCallback((command: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: command }));
    }
  }, []);

  // Store insertPath and sendCommand functions in session for parent access
  useEffect(() => {
    if (terminal && isActive) {
      (session as any).insertPath = insertPathToTerminal;
      (session as any).sendCommand = sendCommandToTerminal;
      (session as any).currentDirectory = currentDirectory;
      (session as any).absolutePath = absolutePathRef.current || '';
    }
  }, [terminal, isActive, insertPathToTerminal, sendCommandToTerminal, currentDirectory, session]);

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800">
      {error && (
        <div className="border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-2 py-1.5">
          <p className="text-xs text-red-900 dark:text-red-200">{error}</p>
        </div>
      )}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-[1fr_auto] gap-2 min-h-0">
        <div ref={terminalContainerRef} className="bg-[#1e1e1e] min-w-0 w-full h-full relative">
          <div ref={terminalRef} className="absolute inset-0" tabIndex={0} />
        </div>
        <VirtualKeyboard
          onKeyPress={handleVirtualKeyPress}
          disabled={!isConnected}
          onFocusTerminal={focusTerminal}
        />
      </div>
    </div>
  );
}
