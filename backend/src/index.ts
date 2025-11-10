// Main Express server entry point
// CodeSync Backend - Production Ready

// Validate environment variables first
import { validateEnv, printEnvSummary } from './utils/validateEnv';
validateEnv();

import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { log, httpLogger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { setCsrfToken } from './middleware/csrf';
import { requestTimeout } from './middleware/timeout';
import { authenticateMetrics } from './middleware/metricsAuth';
import { register } from './utils/metrics';

// Import routes
import authRoutes from './routes/auth.routes';
import sessionRoutes from './routes/session.routes';
import userRoutes from './routes/user.routes';
import invitationRoutes from './routes/invitation.routes';
import snapshotRoutes from './routes/snapshot.routes';
import fileRoutes from './routes/file.routes';

// Import Socket.io server
import { createSocketIOServer } from './websocket/socketio-server';
import { setSocketIOInstance } from './utils/notifications';
import { startCleanupSchedule } from './jobs/cleanup';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Environment variables
const PORT = process.env.PORT || 4000;
const YJS_PORT = process.env.YJS_PORT || 4001;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001',
];

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Configure based on your needs
    crossOriginEmbedderPolicy: false,
  }),
);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// HTTP request logging
app.use(httpLogger);

// Request timeout (30 seconds)
app.use(requestTimeout({ timeout: 30000 }));

// CSRF token setup (set token on all requests)
app.use(setCsrfToken);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Metrics endpoint for Prometheus (secured)
app.get('/metrics', authenticateMetrics, async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api', fileRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
      statusCode: 404,
    },
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Initialize Socket.io
createSocketIOServer(server)
  .then((io) => {
    setSocketIOInstance(io);
    log.info('✅ Socket.io server initialized');
  })
  .catch((error) => {
    log.error('Failed to initialize Socket.io', error);
  });

// Start server
server.listen(PORT, () => {
  printEnvSummary();
  log.info(`🚀 CodeSync API server running on port ${PORT}`);
  log.info(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  log.info(`💬 Socket.io available at ws://localhost:${PORT}/socket.io`);
  log.info(`✅ CORS enabled for: ${ALLOWED_ORIGINS.join(', ')}`);
  log.info(`📝 Note: Start Yjs server separately on port ${YJS_PORT}`);

  // Start automated cleanup jobs
  startCleanupSchedule();
});

// Graceful shutdown
const shutdown = async () => {
  log.info('Shutting down gracefully...');

  server.close(() => {
    log.info('HTTP server closed');
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
  log.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection', reason as Error, { promise });
  process.exit(1);
});

export default app;
