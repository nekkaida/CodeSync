// Yjs WebSocket Server
// Real-time collaborative editing with CRDT

import http from 'http';
import { WebSocketServer } from 'ws';
import { setupWSConnection, setPersistence } from 'y-websocket/bin/utils';
import * as Y from 'yjs';
import { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';
import {
  recordWsConnection,
  recordWsMessage,
  yjsDocumentsActive,
  yjsOperationsTotal,
} from '../utils/metrics';
import { wsRateLimit } from '../middleware/rateLimit';

const prisma = new PrismaClient();

// Store active Yjs documents in memory with last access time
const docs = new Map<string, { doc: Y.Doc; lastAccess: number }>();
const DOCUMENT_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity

// Persistence - save Yjs documents to database
class YjsPersistence {
  async bindState(docName: string, ydoc: Y.Doc): Promise<void> {
    try {
      // Try to load existing document from database
      const sessionFile = await prisma.sessionFile.findFirst({
        where: {
          session_id: docName.split(':')[0], // Extract session ID
          path: docName.split(':')[1] || 'main.txt', // Extract file path
          deleted_at: null,
        },
      });

      if (sessionFile && sessionFile.yjs_state) {
        // Load existing state
        const state = Buffer.from(sessionFile.yjs_state, 'base64');
        Y.applyUpdate(ydoc, state);
        log.debug('Loaded Yjs document from database', { docName });
      }

      // Listen for updates
      ydoc.on('update', async (_update: Uint8Array) => {
        try {
          // Save to database
          const base64State = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');
          const textContent = ydoc.getText('codesync').toString();

          const sessionId = docName.split(':')[0];
          const filePath = docName.split(':')[1] || 'main.txt';

          // Find existing file
          const existingFile = await prisma.sessionFile.findFirst({
            where: {
              session_id: sessionId,
              path: filePath,
            },
          });

          if (existingFile) {
            await prisma.sessionFile.update({
              where: { id: existingFile.id },
              data: {
                content: textContent,
                yjs_state: base64State,
              },
            });
          } else {
            await prisma.sessionFile.create({
              data: {
                session_id: sessionId,
                name: filePath.split('/').pop() || filePath,
                type: 'file',
                path: filePath,
                content: textContent,
                yjs_state: base64State,
                original_name: filePath,
                stored_name: filePath,
                mime_type: 'text/plain',
                size: textContent.length,
                storage_key: `${sessionId}/${filePath}`,
                storage_url: '',
                uploaded_by: 'system',
              },
            });
          }

          yjsOperationsTotal.inc({ operation_type: 'update' });
        } catch (error) {
          log.error('Failed to persist Yjs update', error, { docName });
        }
      });

      log.info('Yjs document bound', { docName });
    } catch (error) {
      log.error('Failed to bind Yjs document', error, { docName });
    }
  }

  async writeState(docName: string, ydoc: Y.Doc): Promise<void> {
    // Called explicitly when document needs to be saved
    try {
      const base64State = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');
      const textContent = ydoc.getText('codesync').toString();

      const sessionId = docName.split(':')[0];
      const filePath = docName.split(':')[1] || 'main.txt';

      // Find existing file
      const existingFile = await prisma.sessionFile.findFirst({
        where: {
          session_id: sessionId,
          path: filePath,
        },
      });

      if (existingFile) {
        await prisma.sessionFile.update({
          where: { id: existingFile.id },
          data: {
            content: textContent,
            yjs_state: base64State,
          },
        });
      } else {
        await prisma.sessionFile.create({
          data: {
            session_id: sessionId,
            name: filePath.split('/').pop() || filePath,
            type: 'file',
            path: filePath,
            content: textContent,
            yjs_state: base64State,
            original_name: filePath,
            stored_name: filePath,
            mime_type: 'text/plain',
            size: textContent.length,
            storage_key: `${sessionId}/${filePath}`,
            storage_url: '',
            uploaded_by: 'system',
          },
        });
      }
    } catch (error) {
      log.error('Failed to write Yjs state', error, { docName });
    }
  }
}

const persistence = new YjsPersistence();

// Setup persistence
setPersistence({
  bindState: persistence.bindState.bind(persistence),
  writeState: persistence.writeState.bind(persistence),
});

// Create Yjs WebSocket server
export const createYjsServer = (port: number = 4001) => {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: any, req: http.IncomingMessage) => {
    const docName = req.url?.slice(1) || 'default';
    const ip = req.socket.remoteAddress || 'unknown';

    log.info('Yjs WebSocket connection', { docName, ip });

    // Rate limiting
    wsRateLimit(ip).then((allowed) => {
      if (!allowed) {
        log.warn('WebSocket rate limit exceeded', { ip });
        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      // Setup Yjs connection
      setupWSConnection(ws, req, docName);

      // Track metrics
      recordWsConnection('yjs', true);
      yjsDocumentsActive.inc();

      // Track document with last access time
      if (!docs.has(docName)) {
        const ydoc = new Y.Doc();
        docs.set(docName, { doc: ydoc, lastAccess: Date.now() });
      } else {
        // Update last access time
        const entry = docs.get(docName);
        if (entry) {
          entry.lastAccess = Date.now();
        }
      }

      // Message tracking
      ws.on('message', () => {
        recordWsMessage('yjs', 'inbound');
      });

      // Cleanup on close
      ws.on('close', () => {
        log.info('Yjs WebSocket closed', { docName, ip });
        recordWsConnection('yjs', false);

        // Check if document is still in use
        const stillInUse = Array.from(wss.clients).some(
          (client: any) => client.readyState === 1 && client.docName === docName,
        );

        if (!stillInUse) {
          // Save and remove document
          const entry = docs.get(docName);
          if (entry) {
            persistence.writeState(docName, entry.doc);
            docs.delete(docName);
            yjsDocumentsActive.dec();
            log.info('Yjs document removed from memory', { docName });
          }
        }
      });

      ws.on('error', (error: Error) => {
        log.error('Yjs WebSocket error', error, { docName, ip });
      });
    });
  });

  server.listen(port, () => {
    log.info(`🔗 Yjs WebSocket server running on port ${port}`);
  });

  // Periodic cleanup of inactive documents
  const cleanupInterval = setInterval(async () => {
    const now = Date.now();
    const docsToCleanup: string[] = [];

    // Find inactive documents
    for (const [docName, entry] of docs.entries()) {
      if (now - entry.lastAccess > DOCUMENT_TIMEOUT) {
        docsToCleanup.push(docName);
      }
    }

    // Cleanup inactive documents
    for (const docName of docsToCleanup) {
      const entry = docs.get(docName);
      if (entry) {
        log.info('Cleaning up inactive Yjs document', { docName, inactiveFor: now - entry.lastAccess });
        await persistence.writeState(docName, entry.doc);
        docs.delete(docName);
        yjsDocumentsActive.dec();
      }
    }

    if (docsToCleanup.length > 0) {
      log.info(`Cleaned up ${docsToCleanup.length} inactive Yjs documents`);
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  return { server, wss, cleanupInterval };
};

// Cleanup function
export const cleanupYjsServer = async () => {
  log.info('Cleaning up Yjs documents...');

  // Save all active documents
  for (const [docName, entry] of docs.entries()) {
    await persistence.writeState(docName, entry.doc);
  }

  docs.clear();
  log.info('Yjs cleanup complete');
};
