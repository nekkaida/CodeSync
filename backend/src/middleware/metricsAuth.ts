// Metrics endpoint authentication
// Secures Prometheus metrics endpoint with token authentication

import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';

export const authenticateMetrics = (req: Request, res: Response, next: NextFunction) => {
  const metricsToken = process.env.METRICS_TOKEN;

  // If no metrics token is configured, allow access (for development)
  if (!metricsToken) {
    if (process.env.NODE_ENV === 'production') {
      log.warn('Metrics endpoint accessed without authentication (METRICS_TOKEN not set)');
    }
    return next();
  }

  // Check Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    log.warn('Metrics endpoint accessed without authorization header', { ip: req.ip });
    return res.status(401).json({
      success: false,
      error: 'Authorization required',
    });
  }

  // Support "Bearer <token>" format
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  if (token !== metricsToken) {
    log.warn('Metrics endpoint accessed with invalid token', { ip: req.ip });
    return res.status(403).json({
      success: false,
      error: 'Invalid authorization token',
    });
  }

  next();
};
