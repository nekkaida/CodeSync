// Redis-backed rate limiting middleware
// High-performance rate limiting using Redis for API and AI usage

import { Request, Response, NextFunction } from 'express';
import { RateLimitType } from '@prisma/client';
import { RateLimitError } from '../utils/errors';
import { rateLimitHits } from '../utils/metrics';
import { getRedisClient } from '../utils/redis';
import { log } from '../utils/logger';

interface RateLimitConfig {
  type: RateLimitType;
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
}

// Rate limit middleware factory using Redis
export const rateLimit = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const redis = getRedisClient();

      // Generate key for rate limiting (user ID or IP)
      const identifier = config.keyGenerator
        ? config.keyGenerator(req)
        : req.user?.id || req.ip || 'anonymous';

      const redisKey = `ratelimit:${config.type}:${identifier}`;
      const now = Date.now();
      const windowSeconds = Math.ceil(config.windowMs / 1000);

      // Use Redis sorted set with sliding window
      const multi = redis.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(redisKey, 0, now - config.windowMs);

      // Count entries in current window
      multi.zcard(redisKey);

      // Add current request
      multi.zadd(redisKey, now, `${now}-${Math.random()}`);

      // Set expiry on key
      multi.expire(redisKey, windowSeconds);

      const results = await multi.exec();

      if (!results) {
        throw new Error('Redis transaction failed');
      }

      // results[1] contains the count before adding current request
      const [, countResult] = results;
      const currentCount = (countResult?.[1] as number) || 0;

      // Calculate remaining requests
      const remaining = Math.max(0, config.maxRequests - currentCount - 1);

      // Set rate limit headers
      const resetTime = new Date(now + config.windowMs);
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime.toISOString(),
      });

      // Check if limit exceeded
      if (currentCount >= config.maxRequests) {
        const retryAfter = Math.ceil(config.windowMs / 1000);

        // Record metric
        rateLimitHits.inc({ type: config.type, user_id: identifier });

        // Add retry-after header
        res.set('Retry-After', retryAfter.toString());

        throw new RateLimitError(
          `Rate limit exceeded. Try again in ${retryAfter} seconds`,
          retryAfter,
        );
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        next(error);
      } else {
        log.error('Rate limit check failed', error);
        // Allow request on Redis error to prevent blocking
        next();
      }
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

// WebSocket rate limiting function
export const wsRateLimit = async (
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60 * 1000,
): Promise<boolean> => {
  try {
    const redis = getRedisClient();
    const redisKey = `ratelimit:WS:${identifier}`;
    const now = Date.now();
    const windowSeconds = Math.ceil(windowMs / 1000);

    // Use Redis sorted set with sliding window
    const multi = redis.multi();

    // Remove old entries outside the window
    multi.zremrangebyscore(redisKey, 0, now - windowMs);

    // Count entries in current window
    multi.zcard(redisKey);

    // Add current request
    multi.zadd(redisKey, now, `${now}-${Math.random()}`);

    // Set expiry on key
    multi.expire(redisKey, windowSeconds);

    const results = await multi.exec();

    if (!results) {
      log.error('Redis transaction failed for WS rate limit');
      return true; // Allow on error
    }

    // results[1] contains the count before adding current request
    const [, countResult] = results;
    const currentCount = (countResult?.[1] as number) || 0;

    if (currentCount >= maxRequests) {
      rateLimitHits.inc({ type: 'WS', user_id: identifier });
      return false;
    }

    return true;
  } catch (error) {
    log.error('WS rate limit check failed', error);
    return true; // Allow on error to prevent blocking
  }
};
