/**
 * SSH Remote Connection Handler
 *
 * Handles remote SSH connections using the ssh2 library
 */

import { Client, ClientChannel } from 'ssh2';
import { RemoteConnectionInfo } from '@/types/ssh';
import * as fs from 'fs';

export class SshRemoteConnection {
  public client: Client;
  private stream: ClientChannel | null = null;

  constructor() {
    this.client = new Client();
  }

  /**
   * Connect to remote SSH server
   * @param info Remote connection information
   * @returns Promise resolving to SSH stream
   */
  async connect(info: RemoteConnectionInfo): Promise<ClientChannel> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.client.end();
        reject(new Error('Connection timeout (30 seconds)'));
      }, 30000);

      this.client.on('ready', () => {
        clearTimeout(timeout);
        console.log(`[SSH Remote] Connected to ${info.host}:${info.port}`);

        this.client.shell(
          {
            term: 'xterm-256color',
            rows: 40,
            cols: 120
          },
          (err, stream) => {
            if (err) {
              reject(err);
              return;
            }

            this.stream = stream;

            // Handle stream events
            stream.on('close', () => {
              console.log('[SSH Remote] Stream closed');
              this.client.end();
            });

            stream.stderr.on('data', (data: Buffer) => {
              console.error('[SSH Remote] stderr:', data.toString());
            });

            resolve(stream);
          }
        );
      });

      this.client.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[SSH Remote] Connection error:', err);
        reject(err);
      });

      this.client.on('close', () => {
        console.log('[SSH Remote] Connection closed');
      });

      this.client.on('end', () => {
        console.log('[SSH Remote] Connection ended');
      });

      // Build connection config
      const config: any = {
        host: info.host,
        port: info.port,
        username: info.username,
        readyTimeout: 30000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
      };

      // Authentication
      if (info.authMethod === 'password' && info.password) {
        config.password = info.password;
      } else if (info.authMethod === 'privateKey' && info.privateKey) {
        try {
          config.privateKey = fs.readFileSync(info.privateKey);
          if (info.passphrase) {
            config.passphrase = info.passphrase;
          }
        } catch (error) {
          reject(new Error(`Failed to read private key file: ${error}`));
          return;
        }
      } else {
        reject(new Error('Invalid authentication method or missing credentials'));
        return;
      }

      // Connect
      this.client.connect(config);
    });
  }

  /**
   * Disconnect from remote server
   */
  disconnect() {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
    this.client.end();
  }

  /**
   * Resize terminal
   */
  resize(rows: number, cols: number) {
    if (this.stream && !this.stream.destroyed) {
      // setWindow(rows, cols, height, width) - height and width in pixels (0 for auto)
      this.stream.setWindow(rows, cols, 0, 0);
    }
  }

  /**
   * Write data to stream
   */
  write(data: string) {
    if (this.stream && !this.stream.destroyed) {
      this.stream.write(data);
    }
  }
}
