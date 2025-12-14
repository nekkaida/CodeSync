// Jest test setup
// Global configuration and mocks for testing

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';
import type { DeepMockProxy } from 'jest-mock-extended';

// Export type for use in tests
export type MockPrismaClient = DeepMockProxy<PrismaClient>;

// Define enums to match Prisma schema
const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
} as const;

const ProgrammingLanguage = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  go: 'go',
  rust: 'rust',
  cpp: 'cpp',
  csharp: 'csharp',
  php: 'php',
  ruby: 'ruby',
} as const;

const SessionVisibility = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
  UNLISTED: 'UNLISTED',
} as const;

const SessionStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  PAUSED: 'PAUSED',
} as const;

const ParticipantRole = {
  OWNER: 'OWNER',
  EDITOR: 'EDITOR',
  COMMENTER: 'COMMENTER',
  VIEWER: 'VIEWER',
} as const;

const MessageType = {
  TEXT: 'TEXT',
  CODE: 'CODE',
  SYSTEM: 'SYSTEM',
  FILE: 'FILE',
} as const;

const RateLimitType = {
  API: 'API',
  AI: 'AI',
  WEBSOCKET: 'WEBSOCKET',
} as const;

const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  INVITE: 'INVITE',
  JOIN: 'JOIN',
  LEAVE: 'LEAVE',
  EXPORT: 'EXPORT',
  REQUEST: 'REQUEST',
  RESTORE: 'RESTORE',
} as const;

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  __esModule: true,
  PrismaClient: jest.fn(() => mockPrisma),
  UserRole,
  ProgrammingLanguage,
  SessionVisibility,
  SessionStatus,
  ParticipantRole,
  MessageType,
  RateLimitType,
  AuditAction,
}));

export const mockPrisma = mockDeep<PrismaClient>();

beforeEach(() => {
  mockReset(mockPrisma);
});

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.CSRF_SECRET = 'test-csrf-secret-for-testing-only';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock Redis
jest.mock('../utils/redis', () => ({
  getRedisClient: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    multi: jest.fn(() => ({
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0], // zremrangebyscore result
        [null, 0], // zcard result (count before add)
        [null, 1], // zadd result
        [null, 1], // expire result
      ]),
    })),
  })),
  closeRedisClient: jest.fn(),
}));

// Mock email service
jest.mock('../services/email.service', () => ({
  __esModule: true,
  default: {
    sendEmail: jest.fn().mockResolvedValue(true),
    sendInvitation: jest.fn().mockResolvedValue(true),
    sendPasswordReset: jest.fn().mockResolvedValue(true),
    sendWelcome: jest.fn().mockResolvedValue(true),
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));
