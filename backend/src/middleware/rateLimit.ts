// Rate limiting middleware
// Tracks API and AI usage with database-backed rate limiting

import { Request, Response, NextFunction } from 'express';
import { PrismaClient, RateLimitType } from '@prisma/client';
import { RateLimitError } from '../utils/errors';
import { rateLimitHits } from '../utils/metrics';
import { log } from '../utils/logger';

const prisma = new PrismaClient();

interface RateLimitConfig {
  type: RateLimitType;
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
}

// Rate limit middleware factory
export const rateLimit = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Generate key for rate limiting (user ID or IP)
      const key = config.keyGenerator
        ? config.keyGenerator(req)
        : req.user?.id || req.ip || 'anonymous';

      const now = new Date();
      const windowStart = new Date(now.getTime() - config.windowMs);

      // Find or create rate limit record
      const rateLimitRecord = await prisma.rateLimit.findFirst({
        where: {
          user_id: key,
          limit_type: config.type,
          window_start: { gte: windowStart },
        },
      });

      if (rateLimitRecord) {
        // Check if limit exceeded
        if (rateLimitRecord.request_count >= config.maxRequests) {
          const resetTime = new Date(rateLimitRecord.window_start.getTime() + config.windowMs);
          const retryAfter = Math.ceil((resetTime.getTime() - now.getTime()) / 1000);

          // Record metric
          rateLimitHits.inc({ type: config.type, user_id: key });

          // Set rate limit headers
          res.set({
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toISOString(),
            'Retry-After': retryAfter.toString(),
          });

          throw new RateLimitError(
            `Rate limit exceeded. Try again in ${retryAfter} seconds`,
            retryAfter,
          );
        }

        // Increment count
        await prisma.rateLimit.update({
          where: { id: rateLimitRecord.id },
          data: { request_count: { increment: 1 } },
        });

        // Set rate limit headers
        const remaining = config.maxRequests - (rateLimitRecord.request_count + 1);
        const resetTime = new Date(rateLimitRecord.window_start.getTime() + config.windowMs);

        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': resetTime.toISOString(),
        });
      } else {
        // Create new rate limit record
        const windowEnd = new Date(now.getTime() + config.windowMs);
        await prisma.rateLimit.create({
          data: {
            user_id: key,
            identifier: key,
            limit_type: config.type,
            count: 0,
            window_start: now,
            window_end: windowEnd,
            request_count: 1,
          },
        });

        // Set rate limit headers
        const resetTime = new Date(now.getTime() + config.windowMs);
        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': (config.maxRequests - 1).toString(),
          'X-RateLimit-Reset': resetTime.toISOString(),
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Predefined rate limiters
export const apiRateLimit = rateLimit({
  type: 'API',
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
});

export const aiRateLimit = rateLimit({
  type: 'AI',
  maxRequests: 20,
  windowMs: 60 * 1000, // 1 minute
  keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
});

export const wsRateLimit = async (
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60 * 1000,
): Promise<boolean> => {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    const rateLimitRecord = await prisma.rateLimit.findFirst({
      where: {
        user_id: identifier,
        limit_type: 'WS',
        window_start: { gte: windowStart },
      },
    });

    if (rateLimitRecord) {
      if (rateLimitRecord.request_count >= maxRequests) {
        rateLimitHits.inc({ type: 'WS', user_id: identifier });
        return false;
      }

      await prisma.rateLimit.update({
        where: { id: rateLimitRecord.id },
        data: { request_count: { increment: 1 } },
      });
    } else {
      const windowEnd = new Date(now.getTime() + windowMs);
      await prisma.rateLimit.create({
        data: {
          user_id: identifier,
          identifier,
          limit_type: 'WS',
          count: 0,
          window_start: now,
          window_end: windowEnd,
          request_count: 1,
        },
      });
    }

    return true;
  } catch (error) {
    log.error('Rate limit check failed', error);
    return true; // Allow on error to prevent blocking
  }
};

// Cleanup old rate limit records (run periodically)
export const cleanupRateLimits = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.rateLimit.deleteMany({
      where: {
        window_start: { lt: oneDayAgo },
      },
    });

    log.info(`Cleaned up ${result.count} old rate limit records`);
  } catch (error) {
    log.error('Failed to cleanup rate limits', error);
  }
};
