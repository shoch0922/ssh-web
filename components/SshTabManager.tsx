/**
 * SSH Tab Manager Component
 *
 * Main component managing multiple SSH terminal tabs
 * Coordinates tab bar, terminal instances, and session state
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

interface SshTabManagerProps {
  initialTmuxSessionId?: string | null;
}

export default function SshTabManager({ initialTmuxSessionId }: SshTabManagerProps) {
  const [sessions, setSessions] = useState<SshSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMaxTabsWarning, setShowMaxTabsWarning] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState<string>('');
  const [currentAbsolutePath, setCurrentAbsolutePath] = useState<string>('');
  const sessionRefs = useMemo(() => new Map<string, {}>(), []);

  // Initialize sessions on mount
  useEffect(() => {
    console.log('[SSH Tab Manager] Initializing session store');
    const store = initializeSessionStore();

    if (initialTmuxSessionId) {
      // Look for an existing session with this tmuxSessionId
      const existing = store.sessions.find(s => s.tmuxSessionId === initialTmuxSessionId);
      if (existing) {
        console.log('[SSH Tab Manager] Found existing session for tmuxSessionId:', initialTmuxSessionId);
        setSessions(store.sessions);
        setActiveSessionId(existing.id);
      } else {
        // Create a new session with the specified tmuxSessionId
        const newSession = createSession(getNextTerminalName(store.sessions));
        newSession.tmuxSessionId = initialTmuxSessionId;
        console.log('[SSH Tab Manager] Creating session for tmuxSessionId:', initialTmuxSessionId);
        const updatedSessions = [...store.sessions, newSession];
        setSessions(updatedSessions);
        setActiveSessionId(newSession.id);
      }
    } else {
      setSessions(store.sessions);
      setActiveSessionId(store.activeSessionId || (store.sessions[0]?.id ?? null));
    }

    setLoading(false);

    console.log('[SSH Tab Manager] Loaded sessions:', {
      count: store.sessions.length,
      active: store.activeSessionId,
      initialTmuxSessionId,
      sessions: store.sessions.map(s => ({ id: s.id, name: s.name, tmuxSessionId: s.tmuxSessionId })),
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

  // Handle opening code-server in new tab
  const handleOpenCodeServer = useCallback(() => {
    // Get absolute path from active session or use fallback
    const baseHomePath = process.env.NEXT_PUBLIC_FILE_MANAGER_BASE_PATH || '/home/shoch0922';
    const absolutePath = currentAbsolutePath || baseHomePath;

    // Build code-server URL with folder query parameter
    const port = 8080;
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const url = `${protocol}//${hostname}:${port}/?folder=${encodeURIComponent(absolutePath)}`;

    console.log('[SSH Tab Manager] Opening code-server:', { absolutePath, url });

    window.open(url, '_blank');
  }, [currentAbsolutePath]);

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

        {/* Code-Server Open Button */}
        <button
          onClick={handleOpenCodeServer}
          disabled={!activeSessionId}
          className="flex-shrink-0 px-3 py-2 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="code-serverを開く"
          title="現在のディレクトリでcode-serverを別タブで開く"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
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

    </div>
  );
}
