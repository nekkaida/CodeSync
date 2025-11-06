// Separate Yjs WebSocket server entry point
// Runs on port 4001

import { createYjsServer, cleanupYjsServer } from './websocket/yjs-server';
import { log } from './utils/logger';

const YJS_PORT = Number(process.env.YJS_PORT) || 4001;

// Start Yjs server
const { server } = createYjsServer(YJS_PORT);

// Graceful shutdown
const shutdown = async () => {
  log.info('Shutting down Yjs server...');

  await cleanupYjsServer();

  server.close(() => {
    log.info('Yjs server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception in Yjs server', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection in Yjs server', reason as Error);
  process.exit(1);
});

