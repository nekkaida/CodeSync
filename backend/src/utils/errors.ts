// Custom error classes for CodeSync
// Production-ready error handling with proper status codes and types

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message, 400, true, code);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', code: string = 'AUTH_REQUIRED') {
    super(message, 401, true, code);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', code: string = 'FORBIDDEN') {
    super(message, 403, true, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(message, 404, true, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = 'CONFLICT') {
    super(message, 409, true, code);
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter?: number,
    code: string = 'RATE_LIMIT',
  ) {
    super(message, 429, true, code);
    this.retryAfter = retryAfter;
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', code: string = 'DATABASE_ERROR') {
    super(message, 500, true, code);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string = 'External service error', code: string = 'EXTERNAL_SERVICE_ERROR') {
    super(message, 502, true, code);
  }
}
