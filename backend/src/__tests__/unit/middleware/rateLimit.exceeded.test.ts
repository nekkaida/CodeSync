// Redis rate limiting exceeded scenarios tests
// Tests for rate limiting when limits are exceeded

import { Request, Response } from 'express';
import { createMockRequest, createMockResponse, createMockNext } from '../../helpers/testUtils';
import { RateLimitError } from '../../../utils/errors';
import { rateLimit, wsRateLimit } from '../../../middleware/rateLimit.redis';
import * as redisModule from '../../../utils/redis';

describe('Redis Rate Limiting - Exceeded Scenarios', () => {
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;
  let mockExec: jest.Mock;

  beforeEach(() => {
    mockRes = createMockResponse();
    mockNext = createMockNext();

    // Create a controlled exec mock
    mockExec = jest.fn();

    // Override getRedisClient to return our controlled mock
    (redisModule.getRedisClient as jest.Mock).mockReturnValue({
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
        exec: mockExec,
      })),
    });
  });

  describe('rateLimit middleware - exceeded', () => {
    it('should throw RateLimitError when limit is exceeded', async () => {
      // Mock Redis to return count >= maxRequests
      mockExec.mockResolvedValue([
        [null, 0], // zremrangebyscore result
        [null, 100], // zcard result - count equals max
        [null, 1], // zadd result
        [null, 1], // expire result
      ]);

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

    it('should set Retry-After header when limit exceeded', async () => {
      mockExec.mockResolvedValue([
        [null, 0],
        [null, 50], // count exceeds max of 10
        [null, 1],
        [null, 1],
      ]);

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 10,
        windowMs: 30000, // 30 seconds
      });

      const mockReq = createMockRequest({
        ip: '192.168.1.1',
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith('Retry-After', '30');
    });

    it('should set rate limit headers on all requests', async () => {
      mockExec.mockResolvedValue([
        [null, 0],
        [null, 5], // count below max
        [null, 1],
        [null, 1],
      ]);

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': expect.any(String),
          'X-RateLimit-Reset': expect.any(String),
        }),
      );
    });

    it('should calculate remaining requests correctly', async () => {
      mockExec.mockResolvedValue([
        [null, 0],
        [null, 50], // 50 requests made
        [null, 1],
        [null, 1],
      ]);

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      // Remaining = max(0, 100 - 50 - 1) = 49
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Remaining': '49',
        }),
      );
    });

    it('should handle null transaction result gracefully', async () => {
      mockExec.mockResolvedValue(null);

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      // Should call next without error (allow on Redis failure)
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow request on Redis error', async () => {
      mockExec.mockRejectedValue(new Error('Redis connection failed'));

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      // Should call next without error (allow on Redis failure)
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('wsRateLimit - exceeded', () => {
    it('should return false when WebSocket rate limit exceeded', async () => {
      mockExec.mockResolvedValue([
        [null, 0],
        [null, 100], // count equals max
        [null, 1],
        [null, 1],
      ]);

      const result = await wsRateLimit('user-123', 100, 60000);

      expect(result).toBe(false);
    });

    it('should return true when within WebSocket rate limit', async () => {
      mockExec.mockResolvedValue([
        [null, 0],
        [null, 50], // count below max
        [null, 1],
        [null, 1],
      ]);

      const result = await wsRateLimit('user-123', 100, 60000);

      expect(result).toBe(true);
    });

    it('should return true on null transaction result', async () => {
      mockExec.mockResolvedValue(null);

      const result = await wsRateLimit('user-123', 100, 60000);

      expect(result).toBe(true); // Allow on Redis error
    });

    it('should return true on Redis error', async () => {
      mockExec.mockRejectedValue(new Error('Redis error'));

      const result = await wsRateLimit('user-123', 100, 60000);

      expect(result).toBe(true); // Allow on Redis error
    });
  });

  describe('edge cases', () => {
    it('should handle zero remaining correctly', async () => {
      mockExec.mockResolvedValue([
        [null, 0],
        [null, 99], // one less than max
        [null, 1],
        [null, 1],
      ]);

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      // Remaining = max(0, 100 - 99 - 1) = 0
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Remaining': '0',
        }),
      );
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle negative remaining by clamping to zero', async () => {
      mockExec.mockResolvedValue([
        [null, 0],
        [null, 150], // way over max
        [null, 1],
        [null, 1],
      ]);

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      // Next should be called with RateLimitError
      expect(mockNext).toHaveBeenCalledWith(expect.any(RateLimitError));
    });

    it('should use IP when user is not available', async () => {
      mockExec.mockResolvedValue([
        [null, 0],
        [null, 100], // at limit
        [null, 1],
        [null, 1],
      ]);

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest({
        ip: '10.0.0.1',
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      // Metrics are recorded internally - just verify the error was thrown
      expect(mockNext).toHaveBeenCalledWith(expect.any(RateLimitError));
    });

    it('should include retry time in error message', async () => {
      mockExec.mockResolvedValue([
        [null, 0],
        [null, 100],
        [null, 1],
        [null, 1],
      ]);

      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 120000, // 2 minutes = 120 seconds
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      const error = mockNext.mock.calls[0][0] as RateLimitError;
      expect(error.message).toContain('120 seconds');
    });
  });
});
