#!/usr/bin/env node
import { startSshServer } from './ssh-server';

const port = process.env.WEBSOCKET_PORT ? parseInt(process.env.WEBSOCKET_PORT) : 8081;

startSshServer(port);

console.log('[SSH Server Standalone] Server is running...');
console.log('[SSH Server Standalone] Press Ctrl+C to stop');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SSH Server Standalone] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[SSH Server Standalone] Shutting down...');
  process.exit(0);
});
