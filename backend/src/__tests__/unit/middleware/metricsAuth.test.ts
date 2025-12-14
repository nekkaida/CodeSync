// Metrics auth middleware tests
// Tests metrics endpoint authentication

import { Request, Response } from 'express';
import { authenticateMetrics } from '../../../middleware/metricsAuth';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  log: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('authenticateMetrics middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockReq = {
      headers: {},
      ip: '127.0.0.1',
    };
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('when METRICS_TOKEN is not set', () => {
    beforeEach(() => {
      delete process.env.METRICS_TOKEN;
    });

    it('should allow access in development', () => {
      process.env.NODE_ENV = 'development';

      authenticateMetrics(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow access in production with warning', () => {
      process.env.NODE_ENV = 'production';

      authenticateMetrics(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      // Logger is mocked, just verify next was called in production
    });
  });

  describe('when METRICS_TOKEN is set', () => {
    beforeEach(() => {
      process.env.METRICS_TOKEN = 'secret-metrics-token';
    });

    it('should return 401 if no authorization header', () => {
      mockReq.headers = {};

      authenticateMetrics(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Authorization required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 for invalid token', () => {
      mockReq.headers = { authorization: 'Bearer wrong-token' };

      authenticateMetrics(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid authorization token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow access with valid Bearer token', () => {
      mockReq.headers = { authorization: 'Bearer secret-metrics-token' };

      authenticateMetrics(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow access with token without Bearer prefix', () => {
      mockReq.headers = { authorization: 'secret-metrics-token' };

      authenticateMetrics(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should reject Bearer prefix with wrong token', () => {
      mockReq.headers = { authorization: 'Bearer invalid' };

      authenticateMetrics(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should handle case-sensitive token comparison', () => {
      mockReq.headers = { authorization: 'Bearer SECRET-METRICS-TOKEN' };

      authenticateMetrics(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
