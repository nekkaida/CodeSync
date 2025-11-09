// Jest test setup
// Global configuration and mocks for testing

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  __esModule: true,
  PrismaClient: jest.fn(() => mockPrisma),
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
      exec: jest.fn().mockResolvedValue([[null, 0], [null, 0]]),
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
