/**
 * SSH WebSocket Server
 *
 * Manages WebSocket connections for local terminals (node-pty + tmux)
 */

import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import { execSync } from "child_process";

interface PtySession {
  ptyProcess: pty.IPty;
  ws: WebSocket;
  tmuxSessionId: string;
  directoryPollingInterval?: NodeJS.Timeout;
  lastDirectory?: string;
}

const sessions = new Map<string, PtySession>();

// tmux availability check
function isTmuxAvailable(): boolean {
  try {
    execSync("which tmux", { stdio: "ignore" });
    return true;
  } catch {
    console.log("[SSH Server] tmux is not available, session persistence disabled");
    return false;
  }
}

// Check if tmux session exists
function tmuxSessionExists(sessionId: string): boolean {
  try {
    execSync(`tmux has-session -t ${sessionId} 2>/dev/null`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Get current directory from tmux session
function getTmuxCurrentDirectory(sessionId: string): string | null {
  try {
    const result = execSync(
      `tmux display-message -p '#{pane_current_path}' -t ${sessionId}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    return result.trim();
  } catch (error) {
    console.error(`[SSH Server] Failed to get current directory for session ${sessionId}:`, error);
    return null;
  }
}

const tmuxAvailable = isTmuxAvailable();

export const startSshServer = (port: number = 3001) => {
  const wss = new WebSocketServer({
    port,
    host: "0.0.0.0",
    clientTracking: true,
    perMessageDeflate: false,
  });

  wss.on("error", (error) => {
    console.error("[SSH Server] WebSocket server error:", error);
  });

  // Keepalive ping (every 30s)
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        (ws as any).isAlive = false;
        ws.ping();
      }
    });
  }, 30000);

  wss.on("connection", (ws: WebSocket) => {
    console.log("[SSH Server] New WebSocket connection");

    (ws as any).isAlive = true;

    let tmuxSessionId: string | null = null;
    let isNewSession = true;

    // Wait for init message (5s timeout)
    const initTimeout = setTimeout(() => {
      console.log("[SSH Server] Client did not send session info, creating new local session");
      initializeLocalPty(null);
    }, 5000);

    const handleInitMessage = (message: Buffer) => {
      try {
        const messageStr = message.toString();
        console.log(`[SSH Server] Received message: ${messageStr.substring(0, 200)}`);
        const parsed = JSON.parse(messageStr);

        if (parsed.type === "init") {
          clearTimeout(initTimeout);
          ws.off("message", handleInitMessage);

          const requestedSessionId = parsed.sessionId;
          console.log(`[SSH Server] Client requested local session: ${requestedSessionId || "new"}`);

          initializeLocalPty(requestedSessionId);
        }
      } catch (error) {
        console.error("[SSH Server] Failed to parse init message:", error, message.toString());
      }
    };

    ws.on("message", handleInitMessage);

    // Initialize local PTY (node-pty + tmux)
    const initializeLocalPty = (requestedSessionId: string | null) => {
      let ptyProcess: pty.IPty;

      if (tmuxAvailable && requestedSessionId && tmuxSessionExists(requestedSessionId)) {
        console.log(`[SSH Server] Attaching to existing tmux session: ${requestedSessionId}`);
        tmuxSessionId = requestedSessionId;
        isNewSession = false;

        ptyProcess = pty.spawn(
          "tmux",
          [
            "attach-session",
            "-t",
            tmuxSessionId,
            ";",
            "set-option",
            "-g",
            "mouse",
            "on",
            ";",
            "set-option",
            "-g",
            "history-limit",
            "50000",
          ],
          {
            name: "xterm-256color",
            cols: 120,
            rows: 40,
            cwd: process.env.HOME,
            env: process.env as { [key: string]: string },
          }
        );
      } else {
        tmuxSessionId = requestedSessionId || `ssh-${Math.random().toString(36).substring(7)}`;
        console.log(`[SSH Server] Creating new session: ${tmuxSessionId}`);

        if (tmuxAvailable) {
          ptyProcess = pty.spawn(
            "tmux",
            [
              "new-session",
              "-s",
              tmuxSessionId,
              ";",
              "set-option",
              "-g",
              "mouse",
              "on",
              ";",
              "set-option",
              "-g",
              "history-limit",
              "50000",
            ],
            {
              name: "xterm-256color",
              cols: 120,
              rows: 40,
              cwd: process.env.HOME,
              env: process.env as { [key: string]: string },
            }
          );
        } else {
          ptyProcess = pty.spawn("bash", [], {
            name: "xterm-256color",
            cols: 120,
            rows: 40,
            cwd: process.env.HOME,
            env: process.env as { [key: string]: string },
          });
        }
      }

      const connectionId = Math.random().toString(36).substring(7);
      sessions.set(connectionId, {
        ptyProcess,
        ws,
        tmuxSessionId: tmuxSessionId || ""
      });

      console.log(`[SSH Server] Local session initialized: connectionId=${connectionId}, tmuxSession=${tmuxSessionId}, isNew=${isNewSession}`);

      ws.send(JSON.stringify({
        type: "session_info",
        sessionId: tmuxSessionId,
        isNewSession,
        tmuxAvailable
      }));

      setupLocalPtyHandlers(connectionId, ptyProcess, ws, tmuxSessionId || "");
    };

    // Setup handlers for local PTY
    const setupLocalPtyHandlers = (connectionId: string, ptyProcess: pty.IPty, ws: WebSocket, tmuxSessionId: string) => {
      ws.on("pong", () => {
        (ws as any).isAlive = true;
      });

      ptyProcess.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "output", data }));
        }
      });

      ws.on("message", (message: Buffer) => {
        try {
          const parsed = JSON.parse(message.toString());

          if (parsed.type === "input") {
            ptyProcess.write(parsed.data);
          } else if (parsed.type === "resize") {
            ptyProcess.resize(parsed.cols, parsed.rows);
          } else if (parsed.type === "close_session") {
            const sessionIdToClose = parsed.sessionId;
            if (tmuxAvailable && sessionIdToClose) {
              console.log(`[SSH Server] Closing tmux session: ${sessionIdToClose}`);
              try {
                execSync(`tmux kill-session -t ${sessionIdToClose}`, { stdio: "ignore" });
                console.log(`[SSH Server] Successfully closed tmux session: ${sessionIdToClose}`);
              } catch (error) {
                console.error(`[SSH Server] Failed to close tmux session: ${sessionIdToClose}`, error);
              }
            }
          }
        } catch (error) {
          console.error("[SSH Server] WebSocket message error:", error);
        }
      });

      ws.on("error", (error) => {
        console.error(`[SSH Server] WebSocket error for connection ${connectionId}:`, error);
      });

      ws.on("close", () => {
        console.log(`[SSH Server] WebSocket closed: ${connectionId}`);

        const session = sessions.get(connectionId);
        if (session?.directoryPollingInterval) {
          clearInterval(session.directoryPollingInterval);
        }

        ptyProcess.kill();
        sessions.delete(connectionId);

        console.log(`[SSH Server] tmux session ${tmuxSessionId} preserved for reconnection`);
      });

      ptyProcess.onExit(() => {
        console.log(`[SSH Server] PTY process exited: ${connectionId}`);

        const session = sessions.get(connectionId);
        if (session?.directoryPollingInterval) {
          clearInterval(session.directoryPollingInterval);
        }

        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        sessions.delete(connectionId);
      });

      // Directory polling for tmux sessions (for code-server integration)
      if (tmuxAvailable && tmuxSessionId) {
        const initialDir = getTmuxCurrentDirectory(tmuxSessionId);
        if (initialDir && ws.readyState === WebSocket.OPEN) {
          const session = sessions.get(connectionId);
          if (session) {
            session.lastDirectory = initialDir;
          }
          ws.send(JSON.stringify({
            type: 'current_directory',
            directory: initialDir,
          }));
          console.log(`[SSH Server] Initial directory sent for ${connectionId}: ${initialDir}`);
        }

        const pollingInterval = parseInt(process.env.DIRECTORY_POLLING_INTERVAL || '2000');

        const directoryPollingInterval = setInterval(() => {
          const session = sessions.get(connectionId);
          if (!session) {
            clearInterval(directoryPollingInterval);
            return;
          }

          const currentDir = getTmuxCurrentDirectory(tmuxSessionId);

          if (currentDir && currentDir !== session.lastDirectory && ws.readyState === WebSocket.OPEN) {
            session.lastDirectory = currentDir;
            ws.send(JSON.stringify({
              type: 'current_directory',
              directory: currentDir,
            }));
            console.log(`[SSH Server] Current directory updated for ${connectionId}: ${currentDir}`);
          }
        }, pollingInterval);

        const session = sessions.get(connectionId);
        if (session) {
          session.directoryPollingInterval = directoryPollingInterval;
        }
      }
    };
  });

  // Timeout check (every 60s)
  const timeoutCheckInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) {
        console.log("[SSH Server] Client timeout detected, terminating connection");
        ws.terminate();
        return;
      }
    });
  }, 60000);

  // Cleanup on shutdown
  wss.on("close", () => {
    clearInterval(pingInterval);
    clearInterval(timeoutCheckInterval);
    console.log("[SSH Server] WebSocket server closed");
  });

  console.log(`[SSH Server] WebSocket server started on port ${port}`);
  console.log(`[SSH Server] Keepalive enabled (ping: 30s, timeout: 60s)`);
  console.log(`[SSH Server] Local connections only (node-pty + tmux)`);
  return wss;
};
