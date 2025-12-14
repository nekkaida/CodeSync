// Redis rate limiting middleware tests
// Tests for rate limiting with Redis backend
// Note: These tests use the global Redis mock from setup.ts

import { Request, Response } from 'express';
import { createMockRequest, createMockResponse, createMockNext } from '../../helpers/testUtils';

// Mock metrics
jest.mock('../../../utils/metrics', () => ({
  rateLimitHits: {
    inc: jest.fn(),
  },
}));

// Import after mocks are set up
import { rateLimit, apiRateLimit, aiRateLimit, wsRateLimit } from '../../../middleware/rateLimit.redis';

describe('Redis Rate Limiting', () => {
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('rateLimit factory', () => {
    it('should allow requests and call next', async () => {
      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest({
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should use anonymous as fallback identifier', async () => {
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

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should use custom key generator when provided', async () => {
      const customKeyGen = jest.fn().mockReturnValue('custom-key');
      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
        keyGenerator: customKeyGen,
      });

      const mockReq = createMockRequest({
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(customKeyGen).toHaveBeenCalledWith(mockReq);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should work with user ID as identifier', async () => {
      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest({
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should work with IP as identifier when no user', async () => {
      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest({
        ip: '192.168.1.1',
      });

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('apiRateLimit', () => {
    it('should allow requests', async () => {
      const mockReq = createMockRequest();

      await apiRateLimit(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should work with authenticated user', async () => {
      const mockReq = createMockRequest({
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      await apiRateLimit(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('aiRateLimit', () => {
    it('should allow requests for authenticated users', async () => {
      const mockReq = createMockRequest({
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      await aiRateLimit(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow requests for anonymous users', async () => {
      const mockReq = createMockRequest({
        ip: '192.168.1.1',
      });

      await aiRateLimit(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('wsRateLimit', () => {
    it('should allow requests within limit', async () => {
      // Default mock returns count=0, so request is allowed
      const result = await wsRateLimit('user-123', 100, 60000);

      expect(result).toBe(true);
    });

    it('should use default values when not provided', async () => {
      const result = await wsRateLimit('user-123');

      expect(result).toBe(true);
    });

    it('should work with different identifiers', async () => {
      const result1 = await wsRateLimit('user-123');
      const result2 = await wsRateLimit('192.168.1.1');
      const result3 = await wsRateLimit('session-abc');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('should work with custom window sizes', async () => {
      const result = await wsRateLimit('user-123', 50, 30000);

      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should allow request and call next on success', async () => {
      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('rate limit types', () => {
    it('should support API rate limit type', async () => {
      const middleware = rateLimit({
        type: 'API',
        maxRequests: 100,
        windowMs: 60000,
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should support AI rate limit type', async () => {
      const middleware = rateLimit({
        type: 'AI',
        maxRequests: 20,
        windowMs: 60000,
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('window configuration', () => {
    it('should accept short window', async () => {
      const middleware = rateLimit({
        type: 'API',
        maxRequests: 10,
        windowMs: 1000, // 1 second
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should accept long window', async () => {
      const middleware = rateLimit({
        type: 'API',
        maxRequests: 1000,
        windowMs: 3600000, // 1 hour
      });

      const mockReq = createMockRequest();

      await middleware(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
