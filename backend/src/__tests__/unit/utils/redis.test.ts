// Redis client tests
// Tests for Redis utility functions

// Unmock redis to test actual implementation
jest.unmock('../../../utils/redis');

// Mock ioredis
const mockOn = jest.fn();
const mockQuit = jest.fn();
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockSetex = jest.fn();
const mockDel = jest.fn();
const mockIncr = jest.fn();
const mockExpire = jest.fn();
const mockTtl = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: mockOn,
    quit: mockQuit,
    get: mockGet,
    set: mockSet,
    setex: mockSetex,
    del: mockDel,
    incr: mockIncr,
    expire: mockExpire,
    ttl: mockTtl,
  }));
});

// Mock logger
jest.mock('../../../utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Redis Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('getRedisClient', () => {
    it('should create a new Redis client on first call', () => {
      const { getRedisClient } = require('../../../utils/redis');
      const Redis = require('ioredis');

      const client = getRedisClient();

      expect(Redis).toHaveBeenCalled();
      expect(client).toBeDefined();
    });

    it('should return the same client on subsequent calls', () => {
      const { getRedisClient } = require('../../../utils/redis');

      const client1 = getRedisClient();
      const client2 = getRedisClient();

      expect(client1).toBe(client2);
    });

    it('should register event handlers on client', () => {
      const { getRedisClient } = require('../../../utils/redis');

      getRedisClient();

      expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should log on connect event', () => {
      const { getRedisClient } = require('../../../utils/redis');
      const { log: mockLog } = require('../../../utils/logger');

      getRedisClient();

      // Get the connect callback
      const connectCallback = mockOn.mock.calls.find((call) => call[0] === 'connect')?.[1];
      connectCallback();

      expect(mockLog.info).toHaveBeenCalledWith('Redis client connected');
    });

    it('should log on error event', () => {
      const { getRedisClient } = require('../../../utils/redis');
      const { log: mockLog } = require('../../../utils/logger');

      getRedisClient();

      // Get the error callback
      const errorCallback = mockOn.mock.calls.find((call) => call[0] === 'error')?.[1];
      const testError = new Error('Connection failed');
      errorCallback(testError);

      expect(mockLog.error).toHaveBeenCalledWith('Redis client error', testError);
    });

    it('should log on close event', () => {
      const { getRedisClient } = require('../../../utils/redis');
      const { log: mockLog } = require('../../../utils/logger');

      getRedisClient();

      // Get the close callback
      const closeCallback = mockOn.mock.calls.find((call) => call[0] === 'close')?.[1];
      closeCallback();

      expect(mockLog.warn).toHaveBeenCalledWith('Redis connection closed');
    });

    it('should use REDIS_URL environment variable', () => {
      process.env.REDIS_URL = 'redis://custom:6380';
      jest.resetModules();

      const { getRedisClient } = require('../../../utils/redis');
      const Redis = require('ioredis');

      getRedisClient();

      expect(Redis).toHaveBeenCalledWith('redis://custom:6380', expect.any(Object));
    });

    it('should use default URL when REDIS_URL not set', () => {
      delete process.env.REDIS_URL;
      jest.resetModules();

      const { getRedisClient } = require('../../../utils/redis');
      const Redis = require('ioredis');

      getRedisClient();

      expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', expect.any(Object));
    });
  });

  describe('closeRedisClient', () => {
    it('should close the client and set it to null', async () => {
      const { getRedisClient, closeRedisClient } = require('../../../utils/redis');
      const { log: mockLog } = require('../../../utils/logger');

      getRedisClient();
      mockQuit.mockResolvedValue('OK');

      await closeRedisClient();

      expect(mockQuit).toHaveBeenCalled();
      expect(mockLog.info).toHaveBeenCalledWith('Redis client disconnected');
    });

    it('should do nothing if client is not initialized', async () => {
      jest.resetModules();
      const { closeRedisClient } = require('../../../utils/redis');

      await closeRedisClient();

      expect(mockQuit).not.toHaveBeenCalled();
    });

    it('should allow creating new client after close', async () => {
      const { getRedisClient, closeRedisClient } = require('../../../utils/redis');
      const Redis = require('ioredis');

      getRedisClient();
      mockQuit.mockResolvedValue('OK');
      await closeRedisClient();

      // Reset the call count
      Redis.mockClear();

      getRedisClient();

      expect(Redis).toHaveBeenCalled();
    });
  });

  describe('redisGet', () => {
    it('should call get on the client', async () => {
      const { redisGet } = require('../../../utils/redis');

      mockGet.mockResolvedValue('value');

      const result = await redisGet('test-key');

      expect(mockGet).toHaveBeenCalledWith('test-key');
      expect(result).toBe('value');
    });

    it('should return null when key does not exist', async () => {
      const { redisGet } = require('../../../utils/redis');

      mockGet.mockResolvedValue(null);

      const result = await redisGet('non-existent-key');

      expect(result).toBeNull();
    });
  });

  describe('redisSet', () => {
    it('should call set when no expiry provided', async () => {
      const { redisSet } = require('../../../utils/redis');

      mockSet.mockResolvedValue('OK');

      await redisSet('test-key', 'test-value');

      expect(mockSet).toHaveBeenCalledWith('test-key', 'test-value');
      expect(mockSetex).not.toHaveBeenCalled();
    });

    it('should call setex when expiry is provided', async () => {
      const { redisSet } = require('../../../utils/redis');

      mockSetex.mockResolvedValue('OK');

      await redisSet('test-key', 'test-value', 3600);

      expect(mockSetex).toHaveBeenCalledWith('test-key', 3600, 'test-value');
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('redisDel', () => {
    it('should call del on the client', async () => {
      const { redisDel } = require('../../../utils/redis');

      mockDel.mockResolvedValue(1);

      await redisDel('test-key');

      expect(mockDel).toHaveBeenCalledWith('test-key');
    });
  });

  describe('redisIncr', () => {
    it('should call incr on the client', async () => {
      const { redisIncr } = require('../../../utils/redis');

      mockIncr.mockResolvedValue(5);

      const result = await redisIncr('counter-key');

      expect(mockIncr).toHaveBeenCalledWith('counter-key');
      expect(result).toBe(5);
    });

    it('should return 1 for new key', async () => {
      const { redisIncr } = require('../../../utils/redis');

      mockIncr.mockResolvedValue(1);

      const result = await redisIncr('new-counter');

      expect(result).toBe(1);
    });
  });

  describe('redisExpire', () => {
    it('should call expire on the client', async () => {
      const { redisExpire } = require('../../../utils/redis');

      mockExpire.mockResolvedValue(1);

      await redisExpire('test-key', 3600);

      expect(mockExpire).toHaveBeenCalledWith('test-key', 3600);
    });
  });

  describe('redisTtl', () => {
    it('should call ttl on the client', async () => {
      const { redisTtl } = require('../../../utils/redis');

      mockTtl.mockResolvedValue(1800);

      const result = await redisTtl('test-key');

      expect(mockTtl).toHaveBeenCalledWith('test-key');
      expect(result).toBe(1800);
    });

    it('should return -1 for key without TTL', async () => {
      const { redisTtl } = require('../../../utils/redis');

      mockTtl.mockResolvedValue(-1);

      const result = await redisTtl('no-ttl-key');

      expect(result).toBe(-1);
    });

    it('should return -2 for non-existent key', async () => {
      const { redisTtl } = require('../../../utils/redis');

      mockTtl.mockResolvedValue(-2);

      const result = await redisTtl('non-existent-key');

      expect(result).toBe(-2);
    });
  });

  describe('default export', () => {
    it('should export getRedisClient and closeRedisClient', () => {
      const redisUtils = require('../../../utils/redis').default;

      expect(redisUtils.getRedisClient).toBeDefined();
      expect(redisUtils.closeRedisClient).toBeDefined();
    });
  });

  describe('retryStrategy', () => {
    it('should calculate retry delay correctly', () => {
      jest.resetModules();

      const { getRedisClient } = require('../../../utils/redis');
      const Redis = require('ioredis');

      getRedisClient();

      // Get the config passed to Redis constructor
      const config = Redis.mock.calls[0][1];
      const retryStrategy = config.retryStrategy;

      // Test retry delays
      expect(retryStrategy(1)).toBe(50); // 1 * 50 = 50
      expect(retryStrategy(2)).toBe(100); // 2 * 50 = 100
      expect(retryStrategy(10)).toBe(500); // 10 * 50 = 500
      expect(retryStrategy(50)).toBe(2000); // min(50 * 50, 2000) = 2000
      expect(retryStrategy(100)).toBe(2000); // min(100 * 50, 2000) = 2000
    });
  });
});
