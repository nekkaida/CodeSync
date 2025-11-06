// Global error handler middleware
// Catches all errors and returns standardized error responses

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { log } from '../utils/logger';
import { recordError } from '../utils/metrics';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // Default to 500 server error
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let isOperational = false;

  // If it's our custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code || 'APP_ERROR';
    isOperational = err.isOperational;
  }

  // Log the error
  if (!isOperational || statusCode >= 500) {
    log.error('Unhandled error', err, {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.id,
    });
  }

  // Record error metric
  recordError(err.name, code);

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const response: any = {
    error: {
      message,
      code,
      statusCode,
    },
  };

  // Include stack trace in development
  if (isDevelopment && err.stack) {
    response.error.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(response);
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
