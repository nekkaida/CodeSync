// Prisma-backed rate limiting middleware tests
// Tests for rate limiting with database backend

import { Request, Response } from 'express';
import { createMockRequest, createMockResponse, createMockNext } from '../../helpers/testUtils';
import { RateLimitError } from '../../../utils/errors';
import { RateLimitType } from '@prisma/client';

// Mock metrics
jest.mock('../../../utils/metrics', () => ({
  rateLimitHits: {
    inc: jest.fn(),
  },
}));

// Get the mock prisma
import { mockPrisma } from '../../setup';

// Import after mocks are set up
import {
  rateLimit,
  apiRateLimit,
  aiRateLimit,
  wsRateLimit,
  cleanupRateLimits,
} from '../../../middleware/rateLimit';

// Helper to create mock rate limit record
const createMockRateLimitRecord = (overrides: Partial<{
  id: string;
  user_id: string;
  identifier: string;
  limit_type: RateLimitType;
  count: number;
  window_start: Date;
  window_end: Date;
  request_count: number;
  created_at: Date;
  updated_at: Date;
}> = {}) => ({
  id: 'rl-1',
  user_id: 'user-123',
  identifier: 'user-123',
  limit_type: 'API' as RateLimitType,
  count: 0,
  window_start: new Date(),
  window_end: new Date(),
  request_count: 1,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('Prisma Rate Limiting', () => {
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('rateLimit factory', () => {
    it('should create new rate limit record when none exists', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue(createMockRateLimitRecord());

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest({
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockPrisma.rateLimit.findFirst).toHaveBeenCalled();
      expect(mockPrisma.rateLimit.create).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should increment existing rate limit record', async () => {
      const windowStart = new Date();
      mockPrisma.rateLimit.findFirst.mockResolvedValue(
        createMockRateLimitRecord({
          window_start: windowStart,
          window_end: new Date(windowStart.getTime() + 60000),
          request_count: 50,
        }),
      );
      mockPrisma.rateLimit.update.mockResolvedValue(
        createMockRateLimitRecord({
          window_start: windowStart,
          window_end: new Date(windowStart.getTime() + 60000),
          request_count: 51,
        }),
      );

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest({
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockPrisma.rateLimit.update).toHaveBeenCalledWith({
        where: { id: 'rl-1' },
        data: { request_count: { increment: 1 } },
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should throw RateLimitError when limit exceeded', async () => {
      const windowStart = new Date();
      mockPrisma.rateLimit.findFirst.mockResolvedValue(
        createMockRateLimitRecord({
          window_start: windowStart,
          window_end: new Date(windowStart.getTime() + 60000),
          request_count: 100, // At limit
        }),
      );

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest({
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(RateLimitError));
    });

    it('should set rate limit headers when limit exceeded', async () => {
      const windowStart = new Date();
      mockPrisma.rateLimit.findFirst.mockResolvedValue(
        createMockRateLimitRecord({
          window_start: windowStart,
          window_end: new Date(windowStart.getTime() + 60000),
          request_count: 100,
        }),
      );

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest({
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'Retry-After': expect.any(String),
        }),
      );
    });

    it('should set headers on successful request with existing record', async () => {
      const windowStart = new Date();
      mockPrisma.rateLimit.findFirst.mockResolvedValue(
        createMockRateLimitRecord({
          window_start: windowStart,
          window_end: new Date(windowStart.getTime() + 60000),
          request_count: 50,
        }),
      );
      mockPrisma.rateLimit.update.mockResolvedValue(
        createMockRateLimitRecord({
          window_start: windowStart,
          window_end: new Date(windowStart.getTime() + 60000),
          request_count: 51,
        }),
      );

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest({
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      // 100 - (50 + 1) = 49 remaining
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '49',
        }),
      );
    });

    it('should set headers on successful request with new record', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue(createMockRateLimitRecord());

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest({
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      // 100 - 1 = 99 remaining
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '99',
        }),
      );
    });

    it('should use IP when user is not available', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue(
        createMockRateLimitRecord({
          user_id: '192.168.1.1',
          identifier: '192.168.1.1',
        }),
      );

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest({
        ip: '192.168.1.1',
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockPrisma.rateLimit.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_id: '192.168.1.1',
          }),
        }),
      );
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should use anonymous when no user or IP', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue(
        createMockRateLimitRecord({
          user_id: 'anonymous',
          identifier: 'anonymous',
        }),
      );

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = {
        ...createMockRequest(),
        ip: undefined,
        user: undefined,
      };

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockPrisma.rateLimit.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_id: 'anonymous',
          }),
        }),
      );
    });

    it('should use custom key generator when provided', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue(
        createMockRateLimitRecord({
          user_id: 'custom-key',
          identifier: 'custom-key',
        }),
      );

      const customKeyGen = jest.fn().mockReturnValue('custom-key');
      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
        keyGenerator: customKeyGen,
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(customKeyGen).toHaveBeenCalledWith(mockReq);
      expect(mockPrisma.rateLimit.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_id: 'custom-key',
          }),
        }),
      );
    });

    it('should pass errors to next middleware', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.rateLimit.findFirst.mockRejectedValue(dbError);

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  describe('apiRateLimit', () => {
    it('should allow requests within limit', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue(
        createMockRateLimitRecord({
          user_id: 'test',
          identifier: 'test',
        }),
      );

      const mockReq = createMockRequest();

      await apiRateLimit(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('aiRateLimit', () => {
    it('should allow AI requests within limit', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue(
        createMockRateLimitRecord({
          limit_type: 'AI',
        }),
      );

      const mockReq = createMockRequest({
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      await aiRateLimit(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should use custom key generator for AI rate limit', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue(
        createMockRateLimitRecord({
          user_id: 'user-456',
          identifier: 'user-456',
          limit_type: 'AI',
        }),
      );

      const mockReq = createMockRequest({
        user: { id: 'user-456', email: 'test@example.com', role: 'USER' },
      });

      await aiRateLimit(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockPrisma.rateLimit.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_id: 'user-456',
          }),
        }),
      );
    });
  });

  describe('wsRateLimit', () => {
    it('should return true when within limit', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue(
        createMockRateLimitRecord({
          limit_type: 'WS' as RateLimitType,
        }),
      );

      const result = await wsRateLimit('user-123', 100, 60000);

      expect(result).toBe(true);
      expect(mockPrisma.rateLimit.create).toHaveBeenCalled();
    });

    it('should return true when incrementing below limit', async () => {
      const windowStart = new Date();
      mockPrisma.rateLimit.findFirst.mockResolvedValue(
        createMockRateLimitRecord({
          limit_type: 'WS' as RateLimitType,
          window_start: windowStart,
          window_end: new Date(windowStart.getTime() + 60000),
          request_count: 50,
        }),
      );
      mockPrisma.rateLimit.update.mockResolvedValue(
        createMockRateLimitRecord({
          limit_type: 'WS' as RateLimitType,
          window_start: windowStart,
          window_end: new Date(windowStart.getTime() + 60000),
          request_count: 51,
        }),
      );

      const result = await wsRateLimit('user-123', 100, 60000);

      expect(result).toBe(true);
      expect(mockPrisma.rateLimit.update).toHaveBeenCalled();
    });

    it('should return false when limit exceeded', async () => {
      const windowStart = new Date();
      mockPrisma.rateLimit.findFirst.mockResolvedValue(
        createMockRateLimitRecord({
          limit_type: 'WS' as RateLimitType,
          window_start: windowStart,
          window_end: new Date(windowStart.getTime() + 60000),
          request_count: 100, // At limit
        }),
      );

      const result = await wsRateLimit('user-123', 100, 60000);

      expect(result).toBe(false);
    });

    it('should return true on database error', async () => {
      mockPrisma.rateLimit.findFirst.mockRejectedValue(new Error('DB error'));

      const result = await wsRateLimit('user-123', 100, 60000);

      expect(result).toBe(true); // Allow on error
    });

    it('should use default values when not provided', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue(
        createMockRateLimitRecord({
          limit_type: 'WS' as RateLimitType,
        }),
      );

      const result = await wsRateLimit('user-123');

      expect(result).toBe(true);
    });
  });

  describe('cleanupRateLimits', () => {
    it('should delete old rate limit records', async () => {
      mockPrisma.rateLimit.deleteMany.mockResolvedValue({ count: 50 });

      await cleanupRateLimits();

      expect(mockPrisma.rateLimit.deleteMany).toHaveBeenCalledWith({
        where: {
          window_start: { lt: expect.any(Date) },
        },
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      mockPrisma.rateLimit.deleteMany.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(cleanupRateLimits()).resolves.not.toThrow();
    });

    it('should log cleanup result', async () => {
      mockPrisma.rateLimit.deleteMany.mockResolvedValue({ count: 100 });

      await cleanupRateLimits();

      // Cleanup completed without error
      expect(mockPrisma.rateLimit.deleteMany).toHaveBeenCalled();
    });
  });
});
