// Authentication middleware
// Verifies JWT tokens from httpOnly cookies and attaches user to request

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthenticationError, AuthorizationError } from '../utils/errors';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET!;

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        name: string;
      };
    }
  }
}

// Verify JWT token and attach user to request
export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Get token from httpOnly cookie
    const token = req.cookies?.token;

    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    // Check if token is blacklisted
    const blacklisted = await prisma.tokenBlacklist.findUnique({
      where: { token },
    });

    if (blacklisted) {
      throw new AuthenticationError('Token has been revoked');
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        deleted_at: true,
      },
    });

    if (!user || user.deleted_at) {
      throw new AuthenticationError('User not found or deleted');
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
};

// Optional authentication (doesn't throw if no token)
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        deleted_at: true,
      },
    });

    if (user && !user.deleted_at) {
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    }

    next();
  } catch (error) {
    // Don't fail if optional auth fails
    next();
  }
};

// Require specific role(s)
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AuthorizationError(`Requires one of the following roles: ${allowedRoles.join(', ')}`),
      );
    }

    next();
  };
};

// Check if user is session owner or has admin role
export const requireSessionAccess = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const sessionId = req.params.sessionId || req.body.sessionId;

    if (!sessionId) {
      throw new AuthorizationError('Session ID required');
    }

    // Admin can access all sessions
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if user is owner or participant
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: { user_id: req.user.id },
        },
      },
    });

    if (!session) {
      throw new AuthorizationError('Session not found or access denied');
    }

    if (session.owner_id === req.user.id || session.participants.length > 0) {
      return next();
    }

    throw new AuthorizationError('Access denied to this session');
  } catch (error) {
    next(error);
  }
};

// Generate JWT token
export const generateToken = (userId: string, email: string, role: string): string => {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '7d' });
};

// Set token as httpOnly cookie
export const setTokenCookie = (res: Response, token: string) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    domain: process.env.COOKIE_DOMAIN || 'localhost',
  });
};

// Clear token cookie
export const clearTokenCookie = (res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    domain: process.env.COOKIE_DOMAIN || 'localhost',
  });
};
