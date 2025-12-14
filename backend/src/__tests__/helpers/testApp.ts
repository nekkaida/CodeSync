// Test app configuration for integration tests
// Creates an Express app without external dependencies

import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from '../../middleware/errorHandler';
import { setCsrfToken } from '../../middleware/csrf';

// Import routes
import authRoutes from '../../routes/auth.routes';
import sessionRoutes from '../../routes/session.routes';
import userRoutes from '../../routes/user.routes';
import invitationRoutes from '../../routes/invitation.routes';
import snapshotRoutes from '../../routes/snapshot.routes';
import fileRoutes from '../../routes/file.routes';

export function createTestApp() {
  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Cookie parser
  app.use(cookieParser());

  // CSRF token setup
  app.use(setCsrfToken);

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
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

  // Global error handler
  app.use(errorHandler);

  return app;
}
