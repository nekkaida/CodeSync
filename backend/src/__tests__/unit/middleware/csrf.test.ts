// CSRF middleware tests
// Tests CSRF token generation and verification

import { Request, Response } from 'express';
import { generateCsrfToken, setCsrfToken, verifyCsrf } from '../../../middleware/csrf';

describe('CSRF middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CSRF_SECRET = 'test-csrf-secret-that-is-at-least-32-chars';
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('generateCsrfToken', () => {
    it('should generate a token for a session ID', () => {
      const token = generateCsrfToken('session-123');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // SHA-256 hex = 64 chars
    });

    it('should generate the same token for the same session ID', () => {
      const token1 = generateCsrfToken('session-123');
      const token2 = generateCsrfToken('session-123');
      expect(token1).toBe(token2);
    });

    it('should generate different tokens for different session IDs', () => {
      const token1 = generateCsrfToken('session-123');
      const token2 = generateCsrfToken('session-456');
      expect(token1).not.toBe(token2);
    });
  });

  describe('setCsrfToken', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: jest.Mock;
    let cookieMock: jest.Mock;
    let setHeaderMock: jest.Mock;

    beforeEach(() => {
      cookieMock = jest.fn();
      setHeaderMock = jest.fn();
      mockReq = {
        cookies: {},
      };
      mockRes = {
        cookie: cookieMock,
        setHeader: setHeaderMock,
      };
      mockNext = jest.fn();
    });

    it('should generate sessionId if not present', () => {
      mockReq.cookies = {};

      setCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(cookieMock).toHaveBeenCalledWith(
        'sessionId',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        }),
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set CSRF token cookie', () => {
      mockReq.cookies = { sessionId: 'existing-session-id' };

      setCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(cookieMock).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          sameSite: 'strict',
        }),
      );
    });

    it('should set X-CSRF-Token header', () => {
      mockReq.cookies = { sessionId: 'existing-session-id' };

      setCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(setHeaderMock).toHaveBeenCalledWith('X-CSRF-Token', expect.any(String));
    });

    it('should use existing sessionId if present', () => {
      mockReq.cookies = { sessionId: 'existing-session-id' };

      setCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      // Should not set a new sessionId cookie
      const sessionIdCalls = cookieMock.mock.calls.filter((call: any) => call[0] === 'sessionId');
      expect(sessionIdCalls.length).toBe(0);
    });

    it('should call next()', () => {
      mockReq.cookies = { sessionId: 'test-session' };

      setCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should set secure cookie in production', () => {
      process.env.NODE_ENV = 'production';
      mockReq.cookies = { sessionId: 'test-session' };

      setCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(cookieMock).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          secure: true,
        }),
      );
    });
  });

  describe('verifyCsrf', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: jest.Mock;

    beforeEach(() => {
      mockReq = {
        method: 'POST',
        cookies: {},
        headers: {},
      };
      mockRes = {};
      mockNext = jest.fn();
    });

    it('should skip verification for GET requests', () => {
      mockReq.method = 'GET';

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should skip verification for HEAD requests', () => {
      mockReq.method = 'HEAD';

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should skip verification for OPTIONS requests', () => {
      mockReq.method = 'OPTIONS';

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should return error if sessionId is missing', () => {
      mockReq.cookies = {};
      mockReq.headers = { 'x-csrf-token': 'some-token' };

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'CSRF token missing',
          code: 'CSRF_MISSING',
        }),
      );
    });

    it('should return error if token is missing', () => {
      mockReq.cookies = { sessionId: 'session-123' };
      mockReq.headers = {};

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'CSRF token missing',
          code: 'CSRF_MISSING',
        }),
      );
    });

    it('should return error for invalid token with different length', () => {
      mockReq.cookies = { sessionId: 'session-123' };
      mockReq.headers = { 'x-csrf-token': 'invalid-token-short' };

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CSRF_ERROR', // timingSafeEqual throws for different lengths
        }),
      );
    });

    it('should return error for invalid token with same length', () => {
      mockReq.cookies = { sessionId: 'session-123' };
      // Generate a 64-char hex string (same length as valid token) but with wrong value
      const wrongToken = '0'.repeat(64);
      mockReq.headers = { 'x-csrf-token': wrongToken };

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid CSRF token',
          code: 'CSRF_INVALID',
        }),
      );
    });

    it('should pass for valid token in header', () => {
      const sessionId = 'session-123';
      const validToken = generateCsrfToken(sessionId);
      mockReq.cookies = { sessionId };
      mockReq.headers = { 'x-csrf-token': validToken };

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should pass for valid token in cookie', () => {
      const sessionId = 'session-123';
      const validToken = generateCsrfToken(sessionId);
      mockReq.cookies = { sessionId, 'csrf-token': validToken };
      mockReq.headers = {};

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should prefer header token over cookie token', () => {
      const sessionId = 'session-123';
      const validToken = generateCsrfToken(sessionId);
      const invalidToken = 'invalid-token-in-cookie-that-should-not-be-used';
      mockReq.cookies = { sessionId, 'csrf-token': invalidToken };
      mockReq.headers = { 'x-csrf-token': validToken };

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should verify POST requests', () => {
      const sessionId = 'session-123';
      const validToken = generateCsrfToken(sessionId);
      mockReq.method = 'POST';
      mockReq.cookies = { sessionId };
      mockReq.headers = { 'x-csrf-token': validToken };

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should verify PUT requests', () => {
      const sessionId = 'session-123';
      const validToken = generateCsrfToken(sessionId);
      mockReq.method = 'PUT';
      mockReq.cookies = { sessionId };
      mockReq.headers = { 'x-csrf-token': validToken };

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should verify DELETE requests', () => {
      const sessionId = 'session-123';
      const validToken = generateCsrfToken(sessionId);
      mockReq.method = 'DELETE';
      mockReq.cookies = { sessionId };
      mockReq.headers = { 'x-csrf-token': validToken };

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should verify PATCH requests', () => {
      const sessionId = 'session-123';
      const validToken = generateCsrfToken(sessionId);
      mockReq.method = 'PATCH';
      mockReq.cookies = { sessionId };
      mockReq.headers = { 'x-csrf-token': validToken };

      verifyCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
