/**
 * SSH Session Store (Extended for ssh-web)
 *
 * Utilities for managing SSH terminal sessions in localStorage
 * Handles session CRUD operations, cleanup, and migrations
 * Extended to support both local and remote connections
 */

import { SshSession, SshSessionStore, ConnectionType, RemoteConnectionInfo } from '@/types/ssh';

/** localStorage key for session store */
const STORAGE_KEY = 'ssh_terminal_sessions';

/** Legacy localStorage key from single-session format */
const LEGACY_STORAGE_KEY = 'ssh_terminal_session_id';

/** Maximum number of tabs allowed */
export const MAX_TABS = 5;

/** Maximum age of sessions in days before cleanup */
export const MAX_AGE_DAYS = 3;

/** Current version of session store format */
const CURRENT_VERSION = 1;

/**
 * Load session store from localStorage
 * Returns empty store if not found or error occurs
 */
export function getSessionStore(): SshSessionStore {
  // Return empty store on server-side
  if (typeof window === 'undefined') {
    return { version: CURRENT_VERSION, activeSessionId: null, sessions: [] };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return { version: CURRENT_VERSION, activeSessionId: null, sessions: [] };
    }

    const parsed = JSON.parse(stored);
    return migrateSessionStore(parsed);
  } catch (error) {
    console.error('[SSH Session Store] Failed to load sessions:', error);
    return { version: CURRENT_VERSION, activeSessionId: null, sessions: [] };
  }
}

/**
 * Save session store to localStorage
 * Handles QuotaExceededError by keeping only active session
 * Note: Passwords are never saved to localStorage (security)
 */
export function saveSessionStore(store: SshSessionStore): void {
  // Skip on server-side
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Create a sanitized copy without sensitive credentials
    const sanitizedStore: SshSessionStore = {
      ...store,
      sessions: store.sessions.map(session => {
        // Remove password/passphrase if present (should never be persisted)
        if (session.remoteInfo) {
          const { ...sanitizedRemoteInfo } = session.remoteInfo;
          return { ...session, remoteInfo: sanitizedRemoteInfo };
        }
        return session;
      })
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedStore));
  } catch (error) {
    console.error('[SSH Session Store] Failed to save sessions:', error);

    // Handle quota exceeded
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('[SSH Session Store] localStorage quota exceeded, saving only active session');

      const activeSession = store.sessions.find(s => s.id === store.activeSessionId);
      if (activeSession) {
        const minimalStore: SshSessionStore = {
          version: CURRENT_VERSION,
          activeSessionId: store.activeSessionId,
          sessions: [activeSession]
        };

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalStore));
        } catch (retryError) {
          console.error('[SSH Session Store] Failed to save even minimal store:', retryError);
        }
      }
    }
  }
}

/**
 * Create a new SSH session with generated ID
 *
 * @param name - Display name for the session
 * @param connectionType - Type of connection (local or remote)
 * @param remoteInfo - Remote connection info (without password/passphrase)
 * @returns New session object
 */
export function createSession(
  name: string,
  connectionType: ConnectionType = 'local',
  remoteInfo?: Omit<RemoteConnectionInfo, 'password' | 'passphrase'>
): SshSession {
  const id = `ssh-${Math.random().toString(36).substring(7)}`;
  const now = new Date().toISOString();

  return {
    id,
    name,
    tmuxSessionId: id,
    createdAt: now,
    lastAccessedAt: now,
    isActive: false,
    connectionType,
    remoteInfo
  };
}

/**
 * Update an existing session with partial data
 *
 * @param store - Current session store
 * @param sessionId - ID of session to update
 * @param updates - Partial session data to merge
 * @returns Updated session store
 */
export function updateSession(
  store: SshSessionStore,
  sessionId: string,
  updates: Partial<SshSession>
): SshSessionStore {
  return {
    ...store,
    sessions: store.sessions.map(session =>
      session.id === sessionId ? { ...session, ...updates } : session
    )
  };
}

/**
 * Delete a session from the store
 *
 * @param store - Current session store
 * @param sessionId - ID of session to delete
 * @returns Updated session store
 */
export function deleteSession(
  store: SshSessionStore,
  sessionId: string
): SshSessionStore {
  const sessions = store.sessions.filter(s => s.id !== sessionId);

  // If deleted session was active, clear activeSessionId
  const activeSessionId = store.activeSessionId === sessionId
    ? null
    : store.activeSessionId;

  return {
    ...store,
    sessions,
    activeSessionId
  };
}

/**
 * Remove sessions older than maxAgeDays
 *
 * @param sessions - Array of sessions to clean
 * @param maxAgeDays - Maximum age in days (default: 3)
 * @returns Filtered array with only recent sessions
 */
export function cleanupOldSessions(
  sessions: SshSession[],
  maxAgeDays: number = MAX_AGE_DAYS
): SshSession[] {
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  return sessions.filter(session => {
    try {
      const lastAccessed = new Date(session.lastAccessedAt).getTime();
      const age = now - lastAccessed;

      if (age > maxAgeMs) {
        console.log(
          `[SSH Session Store] Removing old session: ${session.name} (${session.id}) - ` +
          `last accessed ${Math.floor(age / (24 * 60 * 60 * 1000))} days ago`
        );
        return false;
      }
      return true;
    } catch (error) {
      // Keep session if date parsing fails
      console.error(`[SSH Session Store] Failed to parse date for session ${session.id}:`, error);
      return true;
    }
  });
}

/**
 * Migrate from legacy single-session format to multi-session format
 * Converts 'ssh_terminal_session_id' → 'ssh_terminal_sessions'
 *
 * @returns Migrated session store, or null if no legacy data found
 */
export function migrateFromLegacySession(): SshSessionStore | null {
  // Skip on server-side
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const legacySessionId = localStorage.getItem(LEGACY_STORAGE_KEY);

    if (!legacySessionId) {
      return null; // No legacy data
    }

    console.log('[SSH Session Store] Found legacy session, migrating to multi-session format');

    // Create migrated session (local connection by default)
    const migratedSession: SshSession = {
      id: legacySessionId,
      name: 'Terminal 1',
      tmuxSessionId: legacySessionId,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      isActive: true,
      connectionType: 'local'
    };

    const store: SshSessionStore = {
      version: CURRENT_VERSION,
      activeSessionId: legacySessionId,
      sessions: [migratedSession]
    };

    // Save new format
    saveSessionStore(store);

    // Delete legacy key
    localStorage.removeItem(LEGACY_STORAGE_KEY);

    console.log('[SSH Session Store] Migration complete');
    return store;
  } catch (error) {
    console.error('[SSH Session Store] Failed to migrate legacy session:', error);
    return null;
  }
}

/**
 * Migrate session store to current version
 * Handles version upgrades and ensures data integrity
 *
 * @param store - Session store (possibly old version)
 * @returns Migrated session store
 */
function migrateSessionStore(store: any): SshSessionStore {
  const version = store.version || 0;

  if (version === 0) {
    // Upgrade from unversioned to v1
    console.log('[SSH Session Store] Upgrading session store to v1');

    // Add connectionType to existing sessions (default to local)
    const sessions = Array.isArray(store.sessions)
      ? store.sessions.map((s: any) => ({
          ...s,
          connectionType: s.connectionType || 'local'
        }))
      : [];

    return {
      version: CURRENT_VERSION,
      activeSessionId: store.activeSessionId || null,
      sessions
    };
  }

  if (version === CURRENT_VERSION) {
    // Already current version, but ensure connectionType exists
    const sessions = Array.isArray(store.sessions)
      ? store.sessions.map((s: any) => ({
          ...s,
          connectionType: s.connectionType || 'local'
        }))
      : [];

    return {
      ...store,
      sessions
    };
  }

  // Future version migrations can be added here
  console.warn(`[SSH Session Store] Unknown version ${version}, using as-is`);
  return store as SshSessionStore;
}

/**
 * Validate session store integrity
 * Ensures all required fields exist and data is consistent
 *
 * @param store - Session store to validate
 * @returns Validated (and possibly fixed) session store
 */
export function validateSessionStore(store: SshSessionStore): SshSessionStore {
  // Ensure sessions array exists
  if (!Array.isArray(store.sessions)) {
    console.warn('[SSH Session Store] Invalid sessions array, resetting to empty');
    store.sessions = [];
  }

  // Validate each session
  store.sessions = store.sessions.filter(session => {
    if (!session.id || !session.name || !session.tmuxSessionId) {
      console.warn('[SSH Session Store] Invalid session, removing:', session);
      return false;
    }
    // Ensure connectionType exists
    if (!session.connectionType) {
      session.connectionType = 'local';
    }
    return true;
  });

  // Ensure activeSessionId points to existing session
  if (store.activeSessionId) {
    const activeExists = store.sessions.some(s => s.id === store.activeSessionId);
    if (!activeExists) {
      console.warn('[SSH Session Store] Active session not found, clearing activeSessionId');
      store.activeSessionId = null;
    }
  }

  return store;
}

/**
 * Get the next available terminal name
 *
 * @param existingSessions - Array of existing sessions
 * @param connectionType - Type of connection (affects naming)
 * @returns Next terminal name (e.g., "Terminal 2", "Remote 1")
 */
export function getNextTerminalName(
  existingSessions: SshSession[],
  connectionType: ConnectionType = 'local'
): string {
  const prefix = connectionType === 'local' ? 'Terminal' : 'Remote';

  // Find all names that match the pattern
  const numbers = existingSessions
    .filter(s => s.connectionType === connectionType)
    .map(s => {
      const match = s.name.match(new RegExp(`^${prefix} (\\d+)$`));
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);

  // Find next number (handle gaps)
  if (numbers.length === 0) {
    return `${prefix} 1`;
  }

  const maxNumber = Math.max(...numbers);
  return `${prefix} ${maxNumber + 1}`;
}

/**
 * Check if max tabs limit has been reached
 *
 * @param sessions - Array of sessions
 * @returns True if max tabs reached
 */
export function isMaxTabsReached(sessions: SshSession[]): boolean {
  return sessions.length >= MAX_TABS;
}

/**
 * Initialize session store on first load
 * Handles migration, cleanup, and ensures at least one session exists
 *
 * @returns Initialized session store
 */
export function initializeSessionStore(): SshSessionStore {
  // Try migration from legacy format first
  let store: SshSessionStore = migrateFromLegacySession() || getSessionStore();

  // Cleanup old sessions
  if (store.sessions.length > 0) {
    const cleanedSessions = cleanupOldSessions(store.sessions, MAX_AGE_DAYS);
    if (cleanedSessions.length !== store.sessions.length) {
      store.sessions = cleanedSessions;
      // If active session was cleaned up, clear it
      if (store.activeSessionId && !cleanedSessions.some(s => s.id === store.activeSessionId)) {
        store.activeSessionId = null;
      }
    }
  }

  // Validate store integrity
  store = validateSessionStore(store);

  // Create first session if none exist (local connection)
  if (store.sessions.length === 0) {
    const firstSession = createSession('Terminal 1', 'local');
    store.sessions = [firstSession];
    store.activeSessionId = firstSession.id;
    saveSessionStore(store);
  }

  // Ensure active session is set
  if (!store.activeSessionId && store.sessions.length > 0) {
    store.activeSessionId = store.sessions[0].id;
    saveSessionStore(store);
  }

  return store;
}
