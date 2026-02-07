'use client';

import { useEffect, useState, useRef } from 'react';
import { TmuxSessionInfo } from '@/types/ssh';

interface TmuxSessionSelectorProps {
  onSelectSession: (tmuxSessionId: string) => void;
  onCreateNew: () => void;
}

type LoadingState = 'loading' | 'loaded' | 'error';

export default function TmuxSessionSelector({
  onSelectSession,
  onCreateNew,
}: TmuxSessionSelectorProps) {
  const [sessions, setSessions] = useState<TmuxSessionInfo[]>([]);
  const [tmuxAvailable, setTmuxAvailable] = useState(true);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const hasAutoSkipped = useRef(false);

  useEffect(() => {
    const websocketHost = process.env.NEXT_PUBLIC_WEBSOCKET_HOST || window.location.hostname;
    const websocketPort = process.env.NEXT_PUBLIC_WEBSOCKET_PORT || '3001';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    let websocketUrl: string;
    if (process.env.NEXT_PUBLIC_WEBSOCKET_HOST) {
      websocketUrl = `${protocol}//${websocketHost}`;
    } else {
      websocketUrl = `${protocol}//${websocketHost}:${websocketPort}`;
    }

    console.log('[TmuxSessionSelector] Connecting to', websocketUrl);

    let ws: WebSocket;
    try {
      ws = new WebSocket(websocketUrl);
    } catch (error) {
      console.error('[TmuxSessionSelector] Failed to create WebSocket:', error);
      setLoadingState('error');
      setErrorMessage('WebSocket接続の作成に失敗しました');
      return;
    }
    wsRef.current = ws;

    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.error('[TmuxSessionSelector] Connection timeout');
        ws.close();
        setLoadingState('error');
        setErrorMessage('接続がタイムアウトしました');
      }
    }, 5000);

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      console.log('[TmuxSessionSelector] Connected, requesting session list');
      ws.send(JSON.stringify({ type: 'list_sessions' }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'sessions_list') {
          console.log('[TmuxSessionSelector] Received sessions:', message.sessions.length);
          setSessions(message.sessions);
          setTmuxAvailable(message.tmuxAvailable);
          setLoadingState('loaded');

          // Close WebSocket after receiving response (no init needed)
          ws.close(1000);
        }
      } catch (err) {
        console.error('[TmuxSessionSelector] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      clearTimeout(connectionTimeout);
    };

    ws.onerror = () => {
      clearTimeout(connectionTimeout);
      setLoadingState('error');
      setErrorMessage('サーバーに接続できません');
    };

    return () => {
      clearTimeout(connectionTimeout);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000);
      }
    };
  }, []);

  // Auto-skip if tmux unavailable or no sessions
  useEffect(() => {
    if (loadingState !== 'loaded' || hasAutoSkipped.current) return;

    if (!tmuxAvailable || sessions.length === 0) {
      hasAutoSkipped.current = true;
      console.log('[TmuxSessionSelector] Auto-skipping: tmuxAvailable=', tmuxAvailable, 'sessions=', sessions.length);
      onCreateNew();
    }
  }, [loadingState, tmuxAvailable, sessions, onCreateNew]);

  // Loading state
  if (loadingState === 'loading') {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-green-500" />
          <p className="text-sm text-gray-600 dark:text-gray-400">セッションを取得中...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadingState === 'error') {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="glass rounded-lg p-6 max-w-md text-center">
          <div className="text-red-500 mb-3">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-4">{errorMessage}</p>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md hover:from-green-600 hover:to-emerald-700 transition-all"
          >
            新しいセッションを作成
          </button>
        </div>
      </div>
    );
  }

  // Auto-skip renders nothing while transitioning
  if (!tmuxAvailable || sessions.length === 0) {
    return null;
  }

  // Session list
  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div className="glass rounded-lg p-6 max-w-2xl w-full">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">
          Tmuxセッション一覧
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          既存のセッションに接続するか、新しいセッションを作成してください。
        </p>

        <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
          {sessions.map((session) => (
            <button
              key={session.sessionName}
              onClick={() => onSelectSession(session.sessionName)}
              className="w-full text-left glass rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {session.sessionName}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    session.isAttached
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  }`}
                >
                  {session.isAttached ? 'attached' : 'detached'}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                <div>ウィンドウ数: {session.windowCount}</div>
                {session.currentPath && (
                  <div className="truncate">パス: {session.currentPath}</div>
                )}
                {session.createdAt && (
                  <div>作成: {new Date(session.createdAt).toLocaleString('ja-JP')}</div>
                )}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onCreateNew}
          className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md hover:from-green-600 hover:to-emerald-700 transition-all font-medium"
        >
          新しいセッションを作成
        </button>
      </div>
    </div>
  );
}
