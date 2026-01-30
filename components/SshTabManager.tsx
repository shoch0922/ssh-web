/**
 * SSH Tab Manager Component
 *
 * Main component managing multiple SSH terminal tabs
 * Coordinates tab bar, terminal instances, and session state
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import SshTabBar from './SshTabBar';
import SshTerminalTab from './SshTerminalTab';
import { SshSession, SshSessionStore } from '@/types/ssh';
import {
  initializeSessionStore,
  saveSessionStore,
  createSession,
  getNextTerminalName,
  isMaxTabsReached,
  MAX_TABS,
} from '@/lib/ssh-session-store';

export default function SshTabManager() {
  const [sessions, setSessions] = useState<SshSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMaxTabsWarning, setShowMaxTabsWarning] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState<string>('');
  const [currentAbsolutePath, setCurrentAbsolutePath] = useState<string>('');
  const [codeServerUrl, setCodeServerUrl] = useState<string | null>(null);
  const [isCodeServerModalOpen, setIsCodeServerModalOpen] = useState(false);
  const [isCodeServerStarting, setIsCodeServerStarting] = useState(false);
  const [isCodeServerRunning, setIsCodeServerRunning] = useState(false);
  const [currentCodeServerPort, setCurrentCodeServerPort] = useState<number | null>(null);
  const [showStopConfirmDialog, setShowStopConfirmDialog] = useState(false);
  const sessionRefs = useMemo(() => new Map<string, {}>(), []);

  // Initialize sessions on mount
  useEffect(() => {
    console.log('[SSH Tab Manager] Initializing session store');
    const store = initializeSessionStore();

    setSessions(store.sessions);
    setActiveSessionId(store.activeSessionId || (store.sessions[0]?.id ?? null));
    setLoading(false);

    console.log('[SSH Tab Manager] Loaded sessions:', {
      count: store.sessions.length,
      active: store.activeSessionId,
      sessions: store.sessions.map(s => ({ id: s.id, name: s.name })),
    });
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (!loading && sessions.length > 0) {
      const store: SshSessionStore = {
        version: 1,
        activeSessionId,
        sessions,
      };
      saveSessionStore(store);
    }
  }, [sessions, activeSessionId, loading]);

  // Auto-hide max tabs warning after 3 seconds
  useEffect(() => {
    if (showMaxTabsWarning) {
      const timeout = setTimeout(() => {
        setShowMaxTabsWarning(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [showMaxTabsWarning]);

  // Create new tab
  const handleCreateTab = useCallback(() => {
    if (isMaxTabsReached(sessions)) {
      console.warn('[SSH Tab Manager] Max tabs reached, cannot create new tab');
      setShowMaxTabsWarning(true);
      return;
    }

    const newName = getNextTerminalName(sessions);
    const newSession = createSession(newName);

    console.log('[SSH Tab Manager] Creating new tab:', { id: newSession.id, name: newSession.name });

    setSessions([...sessions, newSession]);
    setActiveSessionId(newSession.id);
  }, [sessions]);

  // Switch to different tab
  const handleTabSwitch = useCallback((sessionId: string) => {
    console.log('[SSH Tab Manager] Switching to tab:', sessionId);

    setActiveSessionId(sessionId);

    // Update lastAccessedAt and current directory
    setSessions(prevSessions =>
      prevSessions.map(session => {
        if (session.id === sessionId) {
          const updated = { ...session, lastAccessedAt: new Date().toISOString() };
          // Update current directory from session
          if ((session as any).currentDirectory) {
            setCurrentDirectory((session as any).currentDirectory);
          }
          return updated;
        }
        return session;
      })
    );
  }, []);

  // Close tab
  const handleTabClose = useCallback((sessionId: string) => {
    console.log('[SSH Tab Manager] Closing tab:', sessionId);

    // If this is the last tab, create a new one instead of closing
    if (sessions.length === 1) {
      console.log('[SSH Tab Manager] Last tab, creating new one instead');
      const newSession = createSession('Terminal 1');
      setSessions([newSession]);
      setActiveSessionId(newSession.id);
      return;
    }

    // Find index of tab being closed
    const index = sessions.findIndex(s => s.id === sessionId);
    const newSessions = sessions.filter(s => s.id !== sessionId);

    setSessions(newSessions);

    // If closing active tab, switch to adjacent tab
    if (sessionId === activeSessionId) {
      // Prefer previous tab, fallback to next
      const newIndex = index > 0 ? index - 1 : 0;
      const newActiveId = newSessions[newIndex]?.id ?? null;
      console.log('[SSH Tab Manager] Switching to adjacent tab:', newActiveId);
      setActiveSessionId(newActiveId);
    }

    // Optionally: Send close_session message to server here
    // This would require a WebSocket connection or API call
  }, [sessions, activeSessionId]);

  // Rename tab
  const handleTabRename = useCallback((sessionId: string, newName: string) => {
    console.log('[SSH Tab Manager] Renaming tab:', { sessionId, newName });

    setSessions(prevSessions =>
      prevSessions.map(session =>
        session.id === sessionId
          ? { ...session, name: newName }
          : session
      )
    );
  }, []);

  // Reorder tabs (drag & drop)
  const handleReorderTabs = useCallback((reorderedSessions: SshSession[]) => {
    console.log('[SSH Tab Manager] Reordering tabs');
    setSessions(reorderedSessions);
  }, []);

  // Handle session updates from terminal tabs
  const handleSessionUpdate = useCallback((updates: Partial<SshSession & { currentDirectory?: string; absolutePath?: string }>) => {
    if (!updates.id) return;

    setSessions(prevSessions =>
      prevSessions.map(session => {
        if (session.id === updates.id) {
          const updated = { ...session, ...updates };

          // Update current directory if provided (needed for code-server integration)
          if ((updates as any).currentDirectory) {
            if (session.id === activeSessionId) {
              setCurrentDirectory((updates as any).currentDirectory);
            }
          }

          // Update absolute path if provided (needed for code-server integration)
          if ((updates as any).absolutePath) {
            if (session.id === activeSessionId) {
              setCurrentAbsolutePath((updates as any).absolutePath);
            }
          }

          return updated;
        }
        return session;
      })
    );
  }, [activeSessionId, sessionRefs]);

  // Handle session errors
  const handleSessionError = useCallback((sessionId: string, error: string) => {
    console.error('[SSH Tab Manager] Session error:', { sessionId, error });
    // Could show toast notification or error indicator on tab
  }, []);

  // Handle code-server launch
  const handleLaunchCodeServer = useCallback(() => {
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) {
      console.error('[SSH Tab Manager] No active session found');
      alert('アクティブなターミナルセッションが見つかりません。');
      return;
    }

    // Get absolute path from session or use current directory
    // If not available, fallback to home directory
    const baseHomePath = process.env.NEXT_PUBLIC_FILE_MANAGER_BASE_PATH || '/home/shoch0922';
    const absolutePath = currentAbsolutePath || (activeSession as any).absolutePath || baseHomePath;

    console.log('[SSH Tab Manager] code-server launch - using directory:', absolutePath);

    // Find available port (starting from 8888)
    const basePort = 8888;
    const maxPort = 8898; // 8888-8898の範囲（11個のポート）

    // Generate a unique port based on session ID hash
    const sessionHash = activeSession.id.split('-').pop() || '0';
    const hashValue = parseInt(sessionHash.slice(0, 2), 16);
    const portOffset = isNaN(hashValue) ? 0 : hashValue % (maxPort - basePort + 1);
    const port = basePort + portOffset;

    console.log('[SSH Tab Manager] Port calculation:', { sessionHash, hashValue, portOffset, port });
    
    setIsCodeServerStarting(true);
    
    // Get sendCommand function from active session
    const sendCommandFn = (activeSession as any).sendCommand;
    
    if (!sendCommandFn) {
      alert('ターミナルに接続できません。接続を確認してください。');
      setIsCodeServerStarting(false);
      return;
    }
    
    // Build code-server command
    // Use nohup to run code-server in background so it persists
    // Escape the path properly for shell
    const escapedPath = absolutePath.replace(/(["'$`\\])/g, '\\$1');
    const codeServerCommand = `cd "${escapedPath}" && nohup code-server --bind-addr 0.0.0.0:${port} --auth none --disable-telemetry > /dev/null 2>&1 &\n`;
    
    console.log('[SSH Tab Manager] Launching code-server:', { absolutePath, port, command: codeServerCommand });
    
    // Send command to terminal via WebSocket
    sendCommandFn(codeServerCommand);
    
    // Store the URL for display
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const url = `${protocol}//${hostname}:${port}`;
    setCodeServerUrl(url);
    setCurrentCodeServerPort(port);

    // Show modal after a short delay
    setTimeout(() => {
      setIsCodeServerStarting(false);
      setIsCodeServerRunning(true);
      setIsCodeServerModalOpen(true);
    }, 1500);
  }, [sessions, activeSessionId, currentAbsolutePath]);

  // Handle code-server stop
  const handleStopCodeServer = useCallback(() => {
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) {
      console.error('[SSH Tab Manager] No active session found');
      alert('アクティブなターミナルセッションが見つかりません。');
      return;
    }

    // Get sendCommand function from active session
    const sendCommandFn = (activeSession as any).sendCommand;

    if (!sendCommandFn) {
      alert('ターミナルに接続できません。接続を確認してください。');
      return;
    }

    // Send pkill command to terminal
    const stopCommand = 'pkill code-server\n';
    console.log('[SSH Tab Manager] Stopping code-server');
    sendCommandFn(stopCommand);

    // Reset state
    setIsCodeServerRunning(false);
    setCurrentCodeServerPort(null);
    setShowStopConfirmDialog(false);
    setIsCodeServerModalOpen(false);
    setCodeServerUrl(null);

    // Show success message
    setTimeout(() => {
      alert('code-serverを停止しました。');
    }, 500);
  }, [sessions, activeSessionId]);

  // Loading state
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-800">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-green-500" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading terminals...</p>
        </div>
      </div>
    );
  }

  // No sessions (should not happen due to initialization, but safety check)
  if (sessions.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-800">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No terminal sessions</p>
          <button
            onClick={handleCreateTab}
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md hover:from-green-600 hover:to-emerald-700 transition-all"
          >
            Create Terminal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800 relative">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
        <SshTabBar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onTabSwitch={handleTabSwitch}
          onTabClose={handleTabClose}
          onTabRename={handleTabRename}
          onCreateTab={handleCreateTab}
          onReorderTabs={handleReorderTabs}
        />

        {/* Code-Server Launch Button */}
        <button
          onClick={handleLaunchCodeServer}
          disabled={isCodeServerStarting || !activeSessionId}
          className="flex-shrink-0 px-3 py-2 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="code-server起動"
          title="現在のディレクトリでcode-serverを起動"
        >
          {isCodeServerStarting ? (
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Max tabs warning */}
      {showMaxTabsWarning && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
          <p className="text-sm text-yellow-900 dark:text-yellow-200">
            最大{MAX_TABS}タブに達しました。新しいタブを作成するには、既存のタブを閉じてください。
          </p>
        </div>
      )}

      {/* Terminal Tabs */}
      <div className="flex-1 relative overflow-hidden">
        {sessions.map(session => (
          <div
            key={session.id}
            className={`absolute inset-0 ${
              session.id === activeSessionId ? 'block' : 'hidden'
            }`}
          >
            <SshTerminalTab
              session={session}
              isActive={session.id === activeSessionId}
              onSessionUpdate={handleSessionUpdate}
              onSessionError={handleSessionError}
            />
          </div>
        ))}
      </div>

      {/* Code-Server URL Modal */}
      {isCodeServerModalOpen && codeServerUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                code-server起動完了
              </h2>
              <button
                onClick={() => {
                  setIsCodeServerModalOpen(false);
                  setCodeServerUrl(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="閉じる"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                code-serverが起動しました。以下のURLにアクセスしてください：
              </p>
              <div className="mb-4">
                <a
                  href={codeServerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    // 別タブで開いたらモーダルを閉じる
                    setTimeout(() => {
                      setIsCodeServerModalOpen(false);
                      setCodeServerUrl(null);
                    }, 300);
                  }}
                  className="block w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md hover:from-green-600 hover:to-emerald-700 transition-all text-center font-medium shadow-md hover:shadow-lg"
                >
                  新しいタブで開く
                </a>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                <input
                  type="text"
                  readOnly
                  value={codeServerUrl}
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 font-mono outline-none"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(codeServerUrl);
                    alert('URLをクリップボードにコピーしました');
                  }}
                  className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                  title="URLをコピー"
                >
                  コピー
                </button>
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setShowStopConfirmDialog(true)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors font-medium"
              >
                停止
              </button>
              <button
                onClick={() => {
                  setIsCodeServerModalOpen(false);
                  setCodeServerUrl(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                閉じる
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>注意:</strong> code-serverはバックグラウンドで実行されています。
                停止するには、下の「停止」ボタンをクリックしてください。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stop Confirmation Dialog */}
      {showStopConfirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-2">
              code-serverを停止しますか？
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              実行中のcode-serverプロセスが終了します。保存されていない作業は失われる可能性があります。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowStopConfirmDialog(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleStopCodeServer}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors font-medium"
              >
                停止する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
