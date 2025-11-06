// CSRF protection middleware
// Generates and validates CSRF tokens for state-changing operations

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthenticationError } from '../utils/errors';

const CSRF_SECRET = process.env.CSRF_SECRET!;
const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'csrf-token';

// Generate CSRF token
export const generateCsrfToken = (sessionId: string): string => {
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(sessionId);
  return hmac.digest('hex');
};

// Verify CSRF token
const verifyCsrfToken = (token: string, sessionId: string): boolean => {
  const expectedToken = generateCsrfToken(sessionId);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
};

// Middleware to set CSRF token
export const setCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  // Generate session ID if not exists
  if (!req.cookies?.sessionId) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: process.env.COOKIE_DOMAIN || 'localhost',
    });
    req.cookies = { ...req.cookies, sessionId };
  }

  // Generate and set CSRF token
  const csrfToken = generateCsrfToken(req.cookies.sessionId);
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false, // Client needs to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    domain: process.env.COOKIE_DOMAIN || 'localhost',
  });

  // Also send in response header for easier access
  res.setHeader('X-CSRF-Token', csrfToken);

  next();
};

// Middleware to verify CSRF token
export const verifyCsrf = (req: Request, _res: Response, next: NextFunction) => {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const sessionId = req.cookies?.sessionId;
  const token = (req.headers[CSRF_HEADER] as string) || req.cookies?.[CSRF_COOKIE];

  if (!sessionId || !token) {
    return next(new AuthenticationError('CSRF token missing', 'CSRF_MISSING'));
  }

  try {
    if (!verifyCsrfToken(token, sessionId)) {
      return next(new AuthenticationError('Invalid CSRF token', 'CSRF_INVALID'));
    }
    next();
  } catch (error) {
    next(new AuthenticationError('CSRF token verification failed', 'CSRF_ERROR'));
  }
};

// Combined middleware: set and verify
export const csrfProtection = [setCsrfToken, verifyCsrf];
