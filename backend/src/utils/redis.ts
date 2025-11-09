// Redis client utility
// Provides Redis connection for caching and rate limiting

import Redis from 'ioredis';
import { log } from './logger';

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableOfflineQueue: false,
      lazyConnect: false,
    });

    redisClient.on('connect', () => {
      log.info('Redis client connected');
    });

    redisClient.on('error', (error) => {
      log.error('Redis client error', error);
    });

    redisClient.on('close', () => {
      log.warn('Redis connection closed');
    });
  }

  return redisClient;
};

export const closeRedisClient = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    log.info('Redis client disconnected');
  }
};

// Helper functions for common Redis operations
export const redisGet = async (key: string): Promise<string | null> => {
  const client = getRedisClient();
  return await client.get(key);
};

export const redisSet = async (
  key: string,
  value: string,
  expirySeconds?: number,
): Promise<void> => {
  const client = getRedisClient();
  if (expirySeconds) {
    await client.setex(key, expirySeconds, value);
  } else {
    await client.set(key, value);
  }
};

export const redisDel = async (key: string): Promise<void> => {
  const client = getRedisClient();
  await client.del(key);
};

export const redisIncr = async (key: string): Promise<number> => {
  const client = getRedisClient();
  return await client.incr(key);
};

export const redisExpire = async (key: string, seconds: number): Promise<void> => {
  const client = getRedisClient();
  await client.expire(key, seconds);
};

export const redisTtl = async (key: string): Promise<number> => {
  const client = getRedisClient();
  return await client.ttl(key);
};

export default { getRedisClient, closeRedisClient };
