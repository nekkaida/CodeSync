// Notification utility
// Sends real-time notifications via Socket.io

import { Server as SocketIOServer } from 'socket.io';
import { log } from './logger';

let io: SocketIOServer | null = null;

export const setSocketIOInstance = (ioInstance: SocketIOServer) => {
  io = ioInstance;
};

interface NotificationPayload {
  type: 'invitation' | 'join' | 'leave' | 'message' | 'snapshot' | 'system';
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export const sendNotification = (userId: string, payload: NotificationPayload) => {
  if (!io) {
    log.warn('Socket.io not initialized, cannot send notification');
    return;
  }

  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...payload,
    timestamp: new Date(),
    read: false,
  };

  // Emit to user's personal room
  io.to(`user:${userId}`).emit('notification', notification);

  log.debug('Notification sent', {
    userId,
    type: payload.type,
    title: payload.title,
  });
};

export const sendSessionNotification = (
  sessionId: string,
  excludeUserId: string | null,
  payload: NotificationPayload,
) => {
  if (!io) {
    log.warn('Socket.io not initialized, cannot send notification');
    return;
  }

  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...payload,
    timestamp: new Date(),
    read: false,
  };

  // Emit to all users in session except the sender
  if (excludeUserId) {
    io.to(`session:${sessionId}`).except(`user:${excludeUserId}`).emit('notification', notification);
  } else {
    io.to(`session:${sessionId}`).emit('notification', notification);
  }

  log.debug('Session notification sent', {
    sessionId,
    excludeUserId,
    type: payload.type,
  });
};
