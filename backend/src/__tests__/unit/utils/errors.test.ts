// Unit tests for custom error classes
// Tests all error types defined in src/utils/errors.ts

import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
} from '../../../utils/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with message and default status code 500', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.code).toBeUndefined();
    });

    it('should create error with custom status code', () => {
      const error = new AppError('Custom error', 418);

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(418);
    });

    it('should create error with custom code', () => {
      const error = new AppError('Error with code', 400, true, 'CUSTOM_CODE');

      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should set isOperational to false when specified', () => {
      const error = new AppError('Non-operational error', 500, false);

      expect(error.isOperational).toBe(false);
    });

    it('should include stack trace', () => {
      const error = new AppError('Error with stack');

      expect(error.stack).toBeDefined();
      // Stack trace contains the error message
      expect(error.stack).toContain('Error with stack');
      // Stack trace contains the test file reference
      expect(error.stack).toContain('errors.test.ts');
    });

    it('should be instanceof Error', () => {
      const error = new AppError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should have correct name property', () => {
      const error = new AppError('Test error');

      expect(error.name).toBe('Error');
    });
  });

  describe('ValidationError', () => {
    it('should have status code 400', () => {
      const error = new ValidationError('Invalid input');

      expect(error.statusCode).toBe(400);
    });

    it('should have default error code VALIDATION_ERROR', () => {
      const error = new ValidationError('Invalid input');

      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow custom error code', () => {
      const error = new ValidationError('Invalid email', 'INVALID_EMAIL');

      expect(error.code).toBe('INVALID_EMAIL');
    });

    it('should be instanceof AppError', () => {
      const error = new ValidationError('Invalid input');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('should be operational', () => {
      const error = new ValidationError('Invalid input');

      expect(error.isOperational).toBe(true);
    });
  });

  describe('AuthenticationError', () => {
    it('should have status code 401', () => {
      const error = new AuthenticationError();

      expect(error.statusCode).toBe(401);
    });

    it('should have default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication required');
    });

    it('should have default error code AUTH_REQUIRED', () => {
      const error = new AuthenticationError();

      expect(error.code).toBe('AUTH_REQUIRED');
    });

    it('should allow custom message', () => {
      const error = new AuthenticationError('Token expired');

      expect(error.message).toBe('Token expired');
    });

    it('should allow custom error code', () => {
      const error = new AuthenticationError('Token expired', 'TOKEN_EXPIRED');

      expect(error.code).toBe('TOKEN_EXPIRED');
    });

    it('should be instanceof AppError', () => {
      const error = new AuthenticationError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(AuthenticationError);
    });
  });

  describe('AuthorizationError', () => {
    it('should have status code 403', () => {
      const error = new AuthorizationError();

      expect(error.statusCode).toBe(403);
    });

    it('should have default message', () => {
      const error = new AuthorizationError();

      expect(error.message).toBe('Insufficient permissions');
    });

    it('should have default error code FORBIDDEN', () => {
      const error = new AuthorizationError();

      expect(error.code).toBe('FORBIDDEN');
    });

    it('should allow custom message', () => {
      const error = new AuthorizationError('Admin access required');

      expect(error.message).toBe('Admin access required');
    });

    it('should allow custom error code', () => {
      const error = new AuthorizationError('Admin only', 'ADMIN_REQUIRED');

      expect(error.code).toBe('ADMIN_REQUIRED');
    });

    it('should be instanceof AppError', () => {
      const error = new AuthorizationError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(AuthorizationError);
    });
  });

  describe('NotFoundError', () => {
    it('should have status code 404', () => {
      const error = new NotFoundError();

      expect(error.statusCode).toBe(404);
    });

    it('should have default message', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
    });

    it('should have default error code NOT_FOUND', () => {
      const error = new NotFoundError();

      expect(error.code).toBe('NOT_FOUND');
    });

    it('should allow custom message', () => {
      const error = new NotFoundError('User not found');

      expect(error.message).toBe('User not found');
    });

    it('should allow custom error code', () => {
      const error = new NotFoundError('Session not found', 'SESSION_NOT_FOUND');

      expect(error.code).toBe('SESSION_NOT_FOUND');
    });

    it('should be instanceof AppError', () => {
      const error = new NotFoundError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(NotFoundError);
    });
  });

  describe('ConflictError', () => {
    it('should have status code 409', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.statusCode).toBe(409);
    });

    it('should have default error code CONFLICT', () => {
      const error = new ConflictError('Duplicate entry');

      expect(error.code).toBe('CONFLICT');
    });

    it('should allow custom error code', () => {
      const error = new ConflictError('Email already exists', 'EMAIL_EXISTS');

      expect(error.code).toBe('EMAIL_EXISTS');
    });

    it('should be instanceof AppError', () => {
      const error = new ConflictError('Conflict');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ConflictError);
    });

    it('should store the message correctly', () => {
      const error = new ConflictError('User with this email already exists');

      expect(error.message).toBe('User with this email already exists');
    });
  });

  describe('RateLimitError', () => {
    it('should have status code 429', () => {
      const error = new RateLimitError();

      expect(error.statusCode).toBe(429);
    });

    it('should have default message', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Rate limit exceeded');
    });

    it('should have default error code RATE_LIMIT', () => {
      const error = new RateLimitError();

      expect(error.code).toBe('RATE_LIMIT');
    });

    it('should include retry after seconds when provided', () => {
      const error = new RateLimitError('Too many requests', 60);

      expect(error.retryAfter).toBe(60);
    });

    it('should have undefined retryAfter when not provided', () => {
      const error = new RateLimitError();

      expect(error.retryAfter).toBeUndefined();
    });

    it('should allow custom message and code', () => {
      const error = new RateLimitError('API limit reached', 120, 'API_LIMIT');

      expect(error.message).toBe('API limit reached');
      expect(error.retryAfter).toBe(120);
      expect(error.code).toBe('API_LIMIT');
    });

    it('should be instanceof AppError', () => {
      const error = new RateLimitError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(RateLimitError);
    });
  });

  describe('DatabaseError', () => {
    it('should have status code 500', () => {
      const error = new DatabaseError();

      expect(error.statusCode).toBe(500);
    });

    it('should have default message', () => {
      const error = new DatabaseError();

      expect(error.message).toBe('Database operation failed');
    });

    it('should have default error code DATABASE_ERROR', () => {
      const error = new DatabaseError();

      expect(error.code).toBe('DATABASE_ERROR');
    });

    it('should allow custom message', () => {
      const error = new DatabaseError('Connection timeout');

      expect(error.message).toBe('Connection timeout');
    });

    it('should allow custom error code', () => {
      const error = new DatabaseError('Query failed', 'QUERY_ERROR');

      expect(error.code).toBe('QUERY_ERROR');
    });

    it('should be instanceof AppError', () => {
      const error = new DatabaseError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(DatabaseError);
    });
  });

  describe('ExternalServiceError', () => {
    it('should have status code 502', () => {
      const error = new ExternalServiceError();

      expect(error.statusCode).toBe(502);
    });

    it('should have default message', () => {
      const error = new ExternalServiceError();

      expect(error.message).toBe('External service error');
    });

    it('should have default error code EXTERNAL_SERVICE_ERROR', () => {
      const error = new ExternalServiceError();

      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
    });

    it('should allow custom message for service name', () => {
      const error = new ExternalServiceError('Email service unavailable');

      expect(error.message).toBe('Email service unavailable');
    });

    it('should allow custom error code', () => {
      const error = new ExternalServiceError('S3 error', 'S3_ERROR');

      expect(error.code).toBe('S3_ERROR');
    });

    it('should be instanceof AppError', () => {
      const error = new ExternalServiceError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ExternalServiceError);
    });
  });

  describe('Error inheritance and type checking', () => {
    it('should allow catching all errors as AppError', () => {
      const errors = [
        new ValidationError('validation'),
        new AuthenticationError('auth'),
        new AuthorizationError('authz'),
        new NotFoundError('not found'),
        new ConflictError('conflict'),
        new RateLimitError('rate limit'),
        new DatabaseError('database'),
        new ExternalServiceError('external'),
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBeGreaterThanOrEqual(400);
        expect(error.statusCode).toBeLessThanOrEqual(502);
      });
    });

    it('should allow catching all errors as Error', () => {
      const errors = [
        new ValidationError('validation'),
        new AuthenticationError('auth'),
        new AuthorizationError('authz'),
        new NotFoundError('not found'),
        new ConflictError('conflict'),
        new RateLimitError('rate limit'),
        new DatabaseError('database'),
        new ExternalServiceError('external'),
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
      });
    });

    it('should have valid status codes for each error type', () => {
      const errors: AppError[] = [
        new ValidationError('test'),
        new AuthenticationError('test'),
        new AuthorizationError('test'),
        new NotFoundError('test'),
        new ConflictError('test'),
        new RateLimitError('test'),
        new DatabaseError('test'),
        new ExternalServiceError('test'),
      ];

      errors.forEach((error) => {
        // Each specific error type has its own status code
        expect([400, 401, 403, 404, 409, 429, 500, 502]).toContain(error.statusCode);
      });
    });
  });

  describe('Error serialization', () => {
    it('should serialize to JSON correctly', () => {
      const error = new ValidationError('Invalid input', 'INVALID_INPUT');
      const json = JSON.stringify(error);

      // Note: Error properties are not automatically serialized
      // This tests that it doesn't throw during serialization
      expect(json).toBeDefined();
      // Verify it's valid JSON by parsing it
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should have readable stack trace', () => {
      function innerFunction() {
        throw new ValidationError('Test error from inner function');
      }

      function outerFunction() {
        innerFunction();
      }

      try {
        outerFunction();
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as Error).stack).toContain('innerFunction');
      }
    });
  });
});
