// Environment validation utility tests
// Tests printEnvSummary and validateEnv functions

// Mock logger before imports
jest.mock('../../../utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { printEnvSummary, validateEnv } from '../../../utils/validateEnv';

describe('printEnvSummary', () => {
  const originalEnv = process.env;

  // Required env vars for configuration
  const validEnv = {
    NODE_ENV: 'test',
    PORT: '4000',
    YJS_PORT: '4001',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'a-very-long-jwt-secret-that-is-at-least-32-characters',
    CSRF_SECRET: 'a-very-long-csrf-secret-that-is-at-least-32-chars',
    SESSION_SECRET: 'a-very-long-session-secret-with-32-or-more-chars',
    S3_ENDPOINT: 'localhost',
    S3_ACCESS_KEY: 'minio-access-key',
    S3_SECRET_KEY: 'minio-secret-key-at-least-8',
    ALLOWED_ORIGINS: 'http://localhost:3000',
    FRONTEND_URL: 'http://localhost:3000',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...validEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should print configuration summary', () => {
    const { log } = require('../../../utils/logger');

    printEnvSummary();

    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('CodeSync Backend Configuration'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Environment:'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('HTTP Port:'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Database:'));
  });

  it('should mask database password in output', () => {
    const { log } = require('../../../utils/logger');
    process.env.DATABASE_URL = 'postgresql://user:secretpass@localhost:5432/db';

    printEnvSummary();

    const calls = log.info.mock.calls.map((c: any) => c[0]);
    const dbCall = calls.find((c: string) => c && c.includes('Database:'));
    expect(dbCall).not.toContain('secretpass');
    expect(dbCall).toContain('****');
  });

  it('should mask redis password in output', () => {
    const { log } = require('../../../utils/logger');
    process.env.REDIS_URL = 'redis://:redispassword@localhost:6379';

    printEnvSummary();

    const calls = log.info.mock.calls.map((c: any) => c[0]);
    const redisCall = calls.find((c: string) => c && c.includes('Redis:'));
    expect(redisCall).not.toContain('redispassword');
    expect(redisCall).toContain('****');
  });

  it('should show SMTP as not configured when SMTP_HOST is not set', () => {
    const { log } = require('../../../utils/logger');
    delete process.env.SMTP_HOST;

    printEnvSummary();

    expect(log.info).toHaveBeenCalledWith('SMTP Configured: No');
  });

  it('should show SMTP as configured when SMTP_HOST is set', () => {
    const { log } = require('../../../utils/logger');
    process.env.SMTP_HOST = 'smtp.example.com';

    printEnvSummary();

    expect(log.info).toHaveBeenCalledWith('SMTP Configured: Yes');
  });

  it('should show Sentry as disabled when SENTRY_DSN is not set', () => {
    const { log } = require('../../../utils/logger');
    delete process.env.SENTRY_DSN;

    printEnvSummary();

    expect(log.info).toHaveBeenCalledWith('Sentry:          Disabled');
  });

  it('should show Sentry as enabled when SENTRY_DSN is set', () => {
    const { log } = require('../../../utils/logger');
    process.env.SENTRY_DSN = 'https://example.sentry.io/12345';

    printEnvSummary();

    expect(log.info).toHaveBeenCalledWith('Sentry:          Enabled');
  });

  it('should use default values when env vars are not set', () => {
    const { log } = require('../../../utils/logger');
    delete process.env.PORT;
    delete process.env.YJS_PORT;
    delete process.env.S3_PORT;
    delete process.env.S3_BUCKET;
    delete process.env.FRONTEND_URL;

    printEnvSummary();

    expect(log.info).toHaveBeenCalledWith('HTTP Port:       4000');
    expect(log.info).toHaveBeenCalledWith('YJS Port:        4001');
    expect(log.info).toHaveBeenCalledWith('S3 Bucket:       codesync-files');
    expect(log.info).toHaveBeenCalledWith('Frontend URL:    http://localhost:3000');
  });

  it('should handle NOT SET for missing DATABASE_URL', () => {
    const { log } = require('../../../utils/logger');
    delete process.env.DATABASE_URL;

    printEnvSummary();

    expect(log.info).toHaveBeenCalledWith('Database:        NOT SET');
  });

  it('should handle NOT SET for missing REDIS_URL', () => {
    const { log } = require('../../../utils/logger');
    delete process.env.REDIS_URL;

    printEnvSummary();

    expect(log.info).toHaveBeenCalledWith('Redis:           NOT SET');
  });
});

describe('validateEnv', () => {
  const originalEnv = process.env;
  const originalExit = process.exit;
  let exitCode: number | undefined;

  // Full valid env configuration
  const validEnv = {
    NODE_ENV: 'test',
    PORT: '4000',
    YJS_PORT: '4001',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'a-very-long-jwt-secret-that-is-at-least-32-characters',
    CSRF_SECRET: 'a-very-long-csrf-secret-that-is-at-least-32-chars',
    SESSION_SECRET: 'a-very-long-session-secret-with-32-or-more-chars',
    S3_ENDPOINT: 'localhost',
    S3_ACCESS_KEY: 'minio-access-key',
    S3_SECRET_KEY: 'minio-secret-key-at-least-8',
    ALLOWED_ORIGINS: 'http://localhost:3000',
    FRONTEND_URL: 'http://localhost:3000',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    exitCode = undefined;
    process.env = { ...validEnv };
    // Replace process.exit with a mock that captures exit code
    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as never;
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  afterAll(() => {
    process.env = originalEnv;
    process.exit = originalExit;
  });

  it('should pass validation with all required env vars set', () => {
    expect(() => validateEnv()).not.toThrow();
  });

  it('should exit when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit when REDIS_URL is missing', () => {
    delete process.env.REDIS_URL;

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit when CSRF_SECRET is missing', () => {
    delete process.env.CSRF_SECRET;

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit when SESSION_SECRET is missing', () => {
    delete process.env.SESSION_SECRET;

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit when S3_ENDPOINT is missing', () => {
    delete process.env.S3_ENDPOINT;

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit when S3_ACCESS_KEY is missing', () => {
    delete process.env.S3_ACCESS_KEY;

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit when S3_SECRET_KEY is missing', () => {
    delete process.env.S3_SECRET_KEY;

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit with invalid NODE_ENV value', () => {
    process.env.NODE_ENV = 'invalid-env';

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit with invalid PORT value', () => {
    process.env.PORT = 'not-a-number';

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit with invalid DATABASE_URL format', () => {
    process.env.DATABASE_URL = 'mysql://invalid';

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit with invalid REDIS_URL format', () => {
    process.env.REDIS_URL = 'http://invalid';

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit with JWT_SECRET too short', () => {
    process.env.JWT_SECRET = 'short';

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit with invalid LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'invalid-level';

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit with invalid FRONTEND_URL format', () => {
    process.env.FRONTEND_URL = 'ftp://invalid.com';

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should exit with invalid S3_USE_SSL value', () => {
    process.env.S3_USE_SSL = 'yes';

    expect(() => validateEnv()).toThrow();
    expect(exitCode).toBe(1);
  });

  it('should set default values for optional vars', () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.ALLOWED_ORIGINS;

    validateEnv();

    expect(process.env.PORT).toBe('4000');
    expect(process.env.NODE_ENV).toBe('development');
    expect(process.env.ALLOWED_ORIGINS).toBe('http://localhost:3000');
  });

  it('should log warnings for optional variables not set', () => {
    const { log } = require('../../../utils/logger');
    delete process.env.SMTP_HOST;
    delete process.env.SENTRY_DSN;

    validateEnv();

    expect(log.warn).toHaveBeenCalled();
  });

  it('should log info messages for default values used', () => {
    const { log } = require('../../../utils/logger');
    delete process.env.PORT;

    validateEnv();

    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Using default for PORT'));
  });
});
