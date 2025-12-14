// Auth middleware tests
// Tests authentication and authorization middleware

import jwt from 'jsonwebtoken';
import {
  authenticate,
  optionalAuth,
  requireRole,
  generateToken,
  setTokenCookie,
  clearTokenCookie,
} from '../../../middleware/auth';
import { AuthenticationError, AuthorizationError } from '../../../utils/errors';
import { createMockRequest, createMockResponse, createMockNext } from '../../helpers/testUtils';
import { mockPrisma } from '../../setup';

// Set JWT secret for tests
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';

describe('Auth Middleware', () => {
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should call next with AuthenticationError when no token provided', async () => {
      const mockReq = createMockRequest({ cookies: {} });

      await authenticate(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toContain('No authentication token');
    });

    it('should call next with AuthenticationError for blacklisted token', async () => {
      const token = generateToken('user-1', 'test@example.com', 'USER');
      const mockReq = createMockRequest({ cookies: { token } });

      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue({
        id: 'blacklist-1',
        token,
        created_at: new Date(),
      } as any);

      await authenticate(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toContain('revoked');
    });

    it('should call next with AuthenticationError for invalid token', async () => {
      const mockReq = createMockRequest({ cookies: { token: 'invalid-token' } });

      await authenticate(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toContain('Invalid token');
    });

    it('should call next with AuthenticationError for expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: 'user-1', email: 'test@example.com', role: 'USER' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1s' },
      );
      const mockReq = createMockRequest({ cookies: { token: expiredToken } });

      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);

      await authenticate(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0];
      // Note: The error message may be "Invalid token" or "Token expired" depending on JWT handling
      expect(['Invalid token', 'Token expired']).toContain(error.message);
    });

    it('should call next with AuthenticationError when user not found', async () => {
      const token = generateToken('user-1', 'test@example.com', 'USER');
      const mockReq = createMockRequest({ cookies: { token } });

      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await authenticate(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toContain('not found');
    });

    it('should call next with AuthenticationError when user is deleted', async () => {
      const token = generateToken('user-1', 'test@example.com', 'USER');
      const mockReq = createMockRequest({ cookies: { token } });

      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        deleted_at: new Date(),
      } as any);

      await authenticate(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should attach user to request and call next() on success', async () => {
      const token = generateToken('user-1', 'test@example.com', 'USER');
      const mockReq = createMockRequest({ cookies: { token } }) as any;

      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        deleted_at: null,
      } as any);

      await authenticate(mockReq, mockRes as any, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe('user-1');
      expect(mockReq.user.email).toBe('test@example.com');
      expect(mockReq.user.name).toBe('Test User');
      expect(mockReq.user.role).toBe('USER');
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('optionalAuth', () => {
    it('should call next() without error when no token provided', async () => {
      const mockReq = createMockRequest({ cookies: {} });

      await optionalAuth(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).user).toBeUndefined();
    });

    it('should attach user if valid token provided', async () => {
      const token = generateToken('user-1', 'test@example.com', 'USER');
      const mockReq = createMockRequest({ cookies: { token } }) as any;

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        deleted_at: null,
      } as any);

      await optionalAuth(mockReq, mockRes as any, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe('user-1');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next() without user if token is invalid', async () => {
      const mockReq = createMockRequest({ cookies: { token: 'invalid' } }) as any;

      await optionalAuth(mockReq, mockRes as any, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next() without user if user is deleted', async () => {
      const token = generateToken('user-1', 'test@example.com', 'USER');
      const mockReq = createMockRequest({ cookies: { token } }) as any;

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        deleted_at: new Date(),
      } as any);

      await optionalAuth(mockReq, mockRes as any, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireRole', () => {
    it('should call next with AuthenticationError when no user', () => {
      const mockReq = createMockRequest();
      const middleware = requireRole('ADMIN');

      middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should call next with AuthorizationError when role not allowed', () => {
      const mockReq = {
        ...createMockRequest(),
        user: { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'USER' },
      };
      const middleware = requireRole('ADMIN');

      middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toContain('ADMIN');
    });

    it('should call next() when user has required role', () => {
      const mockReq = {
        ...createMockRequest(),
        user: { id: 'user-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN' },
      };
      const middleware = requireRole('ADMIN');

      middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow multiple roles', () => {
      const mockReq = {
        ...createMockRequest(),
        user: { id: 'user-1', email: 'mod@example.com', name: 'Mod', role: 'MODERATOR' },
      };
      const middleware = requireRole('ADMIN', 'MODERATOR');

      middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject when role not in allowed list', () => {
      const mockReq = {
        ...createMockRequest(),
        user: { id: 'user-1', email: 'user@example.com', name: 'User', role: 'USER' },
      };
      const middleware = requireRole('ADMIN', 'MODERATOR');

      middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken('user-1', 'test@example.com', 'USER');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct payload', () => {
      const token = generateToken('user-1', 'test@example.com', 'USER');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      expect(decoded.userId).toBe('user-1');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.role).toBe('USER');
    });

    it('should have expiration', () => {
      const token = generateToken('user-1', 'test@example.com', 'USER');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe('setTokenCookie', () => {
    it('should set httpOnly cookie', () => {
      setTokenCookie(mockRes as any, 'test-token');

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'token',
        'test-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        }),
      );
    });

    it('should set maxAge to 7 days', () => {
      setTokenCookie(mockRes as any, 'test-token');

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'token',
        'test-token',
        expect.objectContaining({
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
    });
  });

  describe('clearTokenCookie', () => {
    it('should clear the token cookie', () => {
      clearTokenCookie(mockRes as any);

      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        }),
      );
    });
  });
});
