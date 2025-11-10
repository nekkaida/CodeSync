// Request timeout middleware
// Prevents hanging requests by enforcing timeout limits

import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';

export interface TimeoutOptions {
  timeout?: number; // in milliseconds
  onTimeout?: (req: Request, res: Response) => void;
}

export const requestTimeout = (options: TimeoutOptions = {}) => {
  const timeout = options.timeout || 30000; // Default 30 seconds

  return (req: Request, res: Response, next: NextFunction) => {
    // Set timeout for this request
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        log.warn('Request timeout', {
          method: req.method,
          path: req.path,
          timeout,
          ip: req.ip,
        });

        // Call custom timeout handler if provided
        if (options.onTimeout) {
          options.onTimeout(req, res);
        } else {
          res.status(408).json({
            success: false,
            error: {
              message: 'Request timeout',
              code: 'REQUEST_TIMEOUT',
              statusCode: 408,
            },
          });
        }
      }
    }, timeout);

    // Clear timeout when response finishes
    res.on('finish', () => {
      clearTimeout(timeoutId);
    });

    // Clear timeout when response closes
    res.on('close', () => {
      clearTimeout(timeoutId);
    });

    next();
  };
};
