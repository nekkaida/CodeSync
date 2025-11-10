// Socket.io Server
// Real-time chat and presence

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import { PrismaClient, MessageType } from '@prisma/client';
import { log } from '../utils/logger';
import { recordWsConnection, recordWsMessage, sessionParticipants } from '../utils/metrics';
import { wsRateLimit } from '../middleware/rateLimit.redis';
import { SOCKET_EVENTS } from '../../../shared/contracts/socket-events';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET!;
const REDIS_URL = process.env.REDIS_URL!;

// Create Socket.io server
export const createSocketIOServer = async (httpServer: HTTPServer) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
    path: '/socket.io',
  });

  // Setup Redis adapter for horizontal scaling
  try {
    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();

    // Add error handlers to prevent crashes
    pubClient.on('error', (err) => {
      log.error('Redis Pub Client Error', { error: err.message });
    });

    subClient.on('error', (err) => {
      log.error('Redis Sub Client Error', { error: err.message });
    });

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    log.info('✅ Socket.io Redis adapter configured');
  } catch (error) {
    log.error('Failed to setup Redis adapter', error);
    log.warn('Socket.io running without Redis adapter (single server mode)');
  }

  // Authentication middleware
  io.use(async (socket: any, next) => {
    try {
      const token =
        socket.handshake.auth.token || socket.handshake.headers.cookie?.match(/token=([^;]+)/)?.[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Verify JWT
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, email: true, deleted_at: true },
      });

      if (!user || user.deleted_at) {
        return next(new Error('User not found'));
      }

      // Attach user to socket
      socket.userId = user.id;
      socket.userName = user.name;
      socket.userEmail = user.email;

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', async (socket: any) => {
    const userId = socket.userId;
    const ip = socket.handshake.address;

    log.info('Socket.io connection', { userId, ip });

    // Rate limiting
    const allowed = await wsRateLimit(userId || ip);
    if (!allowed) {
      log.warn('Socket.io rate limit exceeded', { userId, ip });
      socket.disconnect();
      return;
    }

    // Track metrics
    recordWsConnection('socketio', true);

    // Join user's personal notification room
    socket.join(`user:${userId}`);

    // Join session room
    socket.on(SOCKET_EVENTS.SESSION_JOIN, async (sessionId: string) => {
      try {
        // Verify user has access to session
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Session not found' });
          return;
        }

        const hasAccess =
          session.owner_id === userId ||
          session.participants.length > 0 ||
          session.visibility === 'PUBLIC';

        if (!hasAccess) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Access denied' });
          return;
        }

        // Join room
        socket.join(`session:${sessionId}`);
        socket.sessionId = sessionId;

        // Update participant metrics
        const roomSize = io.sockets.adapter.rooms.get(`session:${sessionId}`)?.size || 0;
        sessionParticipants.set({ session_id: sessionId }, roomSize);

        // Notify others
        socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.USER_JOINED, {
          userId,
          userName: socket.userName,
          userEmail: socket.userEmail,
          role: session.participants[0]?.role || 'VIEWER',
          joinedAt: new Date().toISOString(),
        });

        // Send notification to all session participants
        socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.NOTIFICATION, {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'join',
          title: 'User Joined',
          message: `${socket.userName} joined the session`,
          timestamp: new Date(),
          read: false,
        });

        log.info('User joined session', { userId, sessionId });
        recordWsMessage('socketio', 'inbound');
      } catch (error) {
        log.error('Failed to join session', error, { userId, sessionId });
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join session' });
      }
    });

    // Leave session room
    socket.on(SOCKET_EVENTS.SESSION_LEAVE, (sessionId: string) => {
      socket.leave(`session:${sessionId}`);

      // Update metrics
      const roomSize = io.sockets.adapter.rooms.get(`session:${sessionId}`)?.size || 0;
      sessionParticipants.set({ session_id: sessionId }, roomSize);

      // Notify others
      socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.USER_LEFT, {
        userId,
        userName: socket.userName,
        leftAt: new Date().toISOString(),
      });

      // Send notification
      socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.NOTIFICATION, {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'leave',
        title: 'User Left',
        message: `${socket.userName} left the session`,
        timestamp: new Date(),
        read: false,
      });

      log.info('User left session', { userId, sessionId });
      recordWsMessage('socketio', 'inbound');
    });

    // Send chat message
    socket.on(
      SOCKET_EVENTS.CHAT_MESSAGE_SEND,
      async (data: { sessionId: string; content: string; type: MessageType; replyTo?: string }) => {
        try {
          const { sessionId, content, type, replyTo } = data;

          // Save message to database
          const message = await prisma.message.create({
            data: {
              session_id: sessionId,
              user_id: userId,
              content,
              type: type || 'TEXT',
              reply_to: replyTo,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          });

          // Broadcast to room
          io.to(`session:${sessionId}`).emit(SOCKET_EVENTS.CHAT_MESSAGE_NEW, message);

          log.debug('Message sent', {
            userId,
            sessionId,
            messageId: message.id,
          });
          recordWsMessage('socketio', 'outbound');
        } catch (error) {
          log.error('Failed to send message', error, { userId });
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to send message' });
        }
      },
    );

    // React to message
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE_REACT, async (data: { messageId: string; emoji: string }) => {
      try {
        const { messageId, emoji } = data;

        // Save reaction
        const reaction = await prisma.messageReaction.create({
          data: {
            message_id: messageId,
            user_id: userId,
            emoji,
          },
        });

        // Get message to find session
        const message = await prisma.message.findUnique({
          where: { id: messageId },
          select: { session_id: true },
        });

        if (message) {
          io.to(`session:${message.session_id}`).emit('message:reaction', reaction);
        }

        recordWsMessage('socketio', 'outbound');
      } catch (error) {
        log.error('Failed to add reaction', error, { userId });
      }
    });

    // Cursor position update
    socket.on(
      'cursor:update',
      async (data: { sessionId: string; line: number; column: number }) => {
        try {
          const { sessionId, line, column } = data;

          // Update in database
          await prisma.participant.updateMany({
            where: {
              session_id: sessionId,
              user_id: userId,
              left_at: null,
            },
            data: {
              cursor_line: line,
              cursor_column: column,
              last_seen: new Date(),
            },
          });

          // Broadcast to others in session
          socket.to(`session:${sessionId}`).emit('cursor:move', {
            userId,
            userName: socket.userName,
            line,
            column,
          });
        } catch (error) {
          log.error('Failed to update cursor', error, { userId });
        }
      },
    );

    // Typing indicator
    socket.on('typing:start', (sessionId: string) => {
      socket.to(`session:${sessionId}`).emit('user:typing', {
        userId,
        userName: socket.userName,
      });
    });

    socket.on('typing:stop', (sessionId: string) => {
      socket.to(`session:${sessionId}`).emit('user:stopped-typing', {
        userId,
      });
    });

    // Disconnect handler
    socket.on('disconnect', async () => {
      log.info('Socket.io disconnected', { userId, ip });
      recordWsConnection('socketio', false);

      // Update participant metrics for all rooms
      if (socket.sessionId) {
        const roomSize = io.sockets.adapter.rooms.get(`session:${socket.sessionId}`)?.size || 0;
        sessionParticipants.set({ session_id: socket.sessionId }, roomSize);

        // Mark participant as left in database
        try {
          await prisma.participant.updateMany({
            where: {
              session_id: socket.sessionId,
              user_id: userId,
              left_at: null,
            },
            data: {
              left_at: new Date(),
            },
          });
        } catch (error) {
          log.error('Failed to update participant left_at', error);
        }

        // Notify others
        socket.to(`session:${socket.sessionId}`).emit('user:left', {
          userId,
          userName: socket.userName,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Error handler
    socket.on('error', (error: Error) => {
      log.error('Socket.io error', error, { userId, ip });
    });
  });

  log.info('✅ Socket.io server configured');

  return io;
};
