/**
 * SSH Terminal Session Types
 *
 * Type definitions for multi-session SSH terminal management
 * with support for local connections only
 */

/**
 * SSH Terminal session metadata
 * Stored in localStorage for persistence across browser sessions
 */
export interface SshSession {
  /** Unique session identifier (e.g., "ssh-a7b3c9d") */
  id: string;

  /** Display name for the terminal tab (e.g., "Terminal 1", "Server Logs") */
  name: string;

  /** tmux session identifier (same as id for local sessions, unused for remote) */
  tmuxSessionId: string;

  /** ISO 8601 timestamp when the session was created */
  createdAt: string;

  /** ISO 8601 timestamp when the session was last accessed */
  lastAccessedAt: string;

  /** Whether this is currently the active tab */
  isActive: boolean;
}

/**
 * Collection of all SSH sessions
 * Persisted in localStorage under key: 'ssh_terminal_sessions'
 */
export interface SshSessionStore {
  /** Array of all sessions */
  sessions: SshSession[];

  /** ID of the currently active session */
  activeSessionId: string | null;

  /** Version number for future data migrations (current: 1) */
  version: number;
}

/**
 * Session info received from server after WebSocket connection
 */
export interface SshSessionInfo {
  /** Session ID assigned by the server */
  sessionId: string;

  /** Whether this is a newly created session */
  isNewSession: boolean;

  /** Whether tmux is available on the server */
  tmuxAvailable: boolean;
}

/**
 * WebSocket message types for SSH terminal communication
 */
export type SshWebSocketMessage =
  /** Initialize a new session or reconnect to existing */
  | { type: 'init'; sessionId: string | null }

  /** Send user input to the terminal */
  | { type: 'input'; data: string }

  /** Resize the terminal dimensions */
  | { type: 'resize'; cols: number; rows: number }

  /** Server response with session information */
  | { type: 'session_info'; sessionId: string; isNewSession: boolean; tmuxAvailable: boolean }

  /** Terminal output from the server */
  | { type: 'output'; data: string }

  /** Request to explicitly close a session (triggers tmux session cleanup or SSH disconnect) */
  | { type: 'close_session'; sessionId: string }

  /** Error message from server */
  | { type: 'error'; message: string }

  /** Request list of active sessions from server (optional) */
  | { type: 'list_sessions' }

  /** Server response with list of active sessions (optional) */
  | { type: 'sessions_list'; sessions: string[] };

/**
 * Props for the SshTerminalTab component
 */
export interface SshTerminalTabProps {
  /** Session data for this terminal tab */
  session: SshSession;

  /** Whether this tab is currently active/visible */
  isActive: boolean;

  /** Callback to update session data (e.g., connection state, last accessed time) */
  onSessionUpdate: (session: Partial<SshSession>) => void;

  /** Callback when a session error occurs */
  onSessionError: (sessionId: string, error: string) => void;
}

/**
 * Props for the SshTabBar component
 */
export interface SshTabBarProps {
  /** Array of all sessions */
  sessions: SshSession[];

  /** ID of the currently active session */
  activeSessionId: string | null;

  /** Callback when user switches to a different tab */
  onTabSwitch: (sessionId: string) => void;

  /** Callback when user closes a tab */
  onTabClose: (sessionId: string) => void;

  /** Callback when user renames a tab */
  onTabRename: (sessionId: string, newName: string) => void;

  /** Callback when user creates a new tab */
  onCreateTab: () => void;

  /** Callback when user reorders tabs (drag & drop) */
  onReorderTabs?: (reorderedSessions: SshSession[]) => void;
}

/**
 * Connection state for a terminal tab
 */
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

/**
 * Extended session with runtime state (not persisted to localStorage)
 */
export interface SshSessionWithState extends SshSession {
  /** Current connection state */
  connectionState?: ConnectionState;

  /** Error message if connection failed */
  errorMessage?: string;

  /** Number of reconnection attempts */
  reconnectAttempts?: number;
}
