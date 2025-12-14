// Error handler middleware tests
// Tests global error handling functionality

import { errorHandler, asyncHandler } from '../../../middleware/errorHandler';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  DatabaseError,
} from '../../../utils/errors';
import { createMockRequest, createMockResponse, createMockNext } from '../../helpers/testUtils';

// Mock dependencies
jest.mock('../../../utils/logger', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../utils/metrics', () => ({
  recordError: jest.fn(),
}));

describe('errorHandler Middleware', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = createMockRequest({
      method: 'GET',
      path: '/api/test',
    });
    mockRes = createMockResponse();
    mockNext = createMockNext();
    process.env.NODE_ENV = 'test';
  });

  describe('with AppError', () => {
    it('should handle ValidationError (400)', () => {
      const error = new ValidationError('Invalid input', 'INVALID_INPUT');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Invalid input',
          code: 'INVALID_INPUT',
          statusCode: 400,
        },
      });
    });

    it('should handle AuthenticationError (401)', () => {
      const error = new AuthenticationError('Token expired', 'TOKEN_EXPIRED');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Token expired',
          code: 'TOKEN_EXPIRED',
          statusCode: 401,
        },
      });
    });

    it('should handle NotFoundError (404)', () => {
      const error = new NotFoundError('User not found', 'USER_NOT_FOUND');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          statusCode: 404,
        },
      });
    });

    it('should handle DatabaseError (500)', () => {
      const error = new DatabaseError('Connection failed', 'DB_CONNECTION_ERROR');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Connection failed',
          code: 'DB_CONNECTION_ERROR',
          statusCode: 500,
        },
      });
    });

    it('should use default code APP_ERROR when error has no code', () => {
      const error = new AppError('Generic error', 400);

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Generic error',
          code: 'APP_ERROR',
          statusCode: 400,
        },
      });
    });
  });

  describe('with generic Error', () => {
    it('should handle generic Error with 500 status', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
          statusCode: 500,
        },
      });
    });

    it('should not expose internal error message', () => {
      const error = new Error('Database connection string: postgres://user:pass@localhost');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.message).toBe('Internal server error');
      expect(response.error.message).not.toContain('postgres://');
    });
  });

  describe('stack trace in development', () => {
    it('should include stack trace in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = new ValidationError('Invalid input');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.stack).toBeDefined();
    });

    it('should not include stack trace in production mode', () => {
      process.env.NODE_ENV = 'production';
      const error = new ValidationError('Invalid input');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.stack).toBeUndefined();
    });

    it('should not include stack trace in test mode', () => {
      process.env.NODE_ENV = 'test';
      const error = new ValidationError('Invalid input');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.stack).toBeUndefined();
    });
  });

  describe('logging', () => {
    it('should log 500 errors', () => {
      const { log } = require('../../../utils/logger');
      const error = new Error('Server crash');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(log.error).toHaveBeenCalled();
    });

    it('should log non-operational errors', () => {
      const { log } = require('../../../utils/logger');
      const error = new AppError('Critical failure', 400, false);

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(log.error).toHaveBeenCalled();
    });

    it('should not log operational 4xx errors', () => {
      const { log } = require('../../../utils/logger');
      log.error.mockClear();
      const error = new ValidationError('Bad input');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(log.error).not.toHaveBeenCalled();
    });
  });

  describe('metrics', () => {
    it('should record error metrics', () => {
      const { recordError } = require('../../../utils/metrics');
      const error = new ValidationError('Bad input', 'BAD_INPUT');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(recordError).toHaveBeenCalledWith('Error', 'BAD_INPUT');
    });
  });
});

describe('asyncHandler', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  it('should execute async function successfully', async () => {
    const handler = jest.fn().mockResolvedValue('success');
    const wrapped = asyncHandler(handler);

    await wrapped(mockReq as any, mockRes as any, mockNext);

    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should catch async errors and pass to next', async () => {
    const error = new Error('Async error');
    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);

    await wrapped(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should catch thrown errors in async function', async () => {
    const error = new ValidationError('Validation failed');
    const handler = jest.fn().mockImplementation(async () => {
      throw error;
    });
    const wrapped = asyncHandler(handler);

    await wrapped(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should handle sync functions that return promises', async () => {
    const handler = jest.fn().mockImplementation(() => {
      return Promise.resolve('done');
    });
    const wrapped = asyncHandler(handler);

    await wrapped(mockReq as any, mockRes as any, mockNext);

    expect(handler).toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });
});
