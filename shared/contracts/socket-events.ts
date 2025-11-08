/**
 * Socket.io Event Contract
 * Shared between backend and frontend to ensure event name consistency
 */

export const SOCKET_EVENTS = {
  // ============================================================================
  // CHAT EVENTS
  // ============================================================================
  CHAT_MESSAGE_SEND: 'chat:message:send',
  CHAT_MESSAGE_NEW: 'chat:message:new',
  CHAT_MESSAGE_REACT: 'chat:message:react',
  CHAT_MESSAGE_HISTORY: 'chat:message:history',
  CHAT_TYPING_START: 'chat:typing:start',
  CHAT_TYPING_STOP: 'chat:typing:stop',

  // ============================================================================
  // SESSION EVENTS
  // ============================================================================
  SESSION_JOIN: 'session:join',
  SESSION_LEAVE: 'session:leave',
  SESSION_UPDATE: 'session:update',

  // ============================================================================
  // USER EVENTS
  // ============================================================================
  USER_JOINED: 'user:joined',
  USER_LEFT: 'user:left',
  USER_TYPING: 'user:typing',
  USER_CURSOR_MOVE: 'user:cursor:move',

  // ============================================================================
  // CURSOR EVENTS
  // ============================================================================
  CURSOR_MOVE: 'cursor:move',
  CURSOR_UPDATE: 'cursor:update',

  // ============================================================================
  // PARTICIPANT EVENTS
  // ============================================================================
  PARTICIPANTS_LIST: 'participants:list',
  PARTICIPANTS_UPDATE: 'participants:update',

  // ============================================================================
  // NOTIFICATION EVENTS
  // ============================================================================
  NOTIFICATION: 'notification',

  // ============================================================================
  // SNAPSHOT EVENTS
  // ============================================================================
  SNAPSHOT_CREATED: 'snapshot:created',
  SNAPSHOT_RESTORED: 'snapshot:restored',

  // ============================================================================
  // ERROR EVENTS
  // ============================================================================
  ERROR: 'error',
  DISCONNECT: 'disconnect',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

// ============================================================================
// TYPE DEFINITIONS FOR EVENT PAYLOADS
// ============================================================================

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  sessionId: string;
  parentId?: string | null;
  createdAt: Date | string;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface UserJoinedPayload {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  joinedAt: Date | string;
}

export interface UserLeftPayload {
  userId: string;
  userName: string;
  leftAt: Date | string;
}

export interface CursorPosition {
  userId: string;
  userName: string;
  line: number;
  column: number;
  filePath?: string;
}

export interface ParticipantInfo {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  isOnline: boolean;
  lastSeen?: Date | string;
  cursor?: {
    line: number;
    column: number;
    filePath?: string;
  };
}

export interface NotificationPayload {
  type: 'info' | 'success' | 'warning' | 'error' | 'invitation';
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface SnapshotEvent {
  snapshotId: string;
  sessionId: string;
  createdBy?: string;
  timestamp: Date | string;
}
