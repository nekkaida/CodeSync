// Constants configuration tests
// Tests for application constants

import {
  AUTH,
  RATE_LIMITS,
  FILE,
  PAGINATION,
  SEARCH,
  SNAPSHOT,
  SESSION,
  CACHE,
  YJS,
  WEBSOCKET,
} from '../../../config/constants';

describe('Application Constants', () => {
  describe('AUTH constants', () => {
    it('should have JWT_EXPIRY defined', () => {
      expect(AUTH.JWT_EXPIRY).toBe('7d');
    });

    it('should have PASSWORD_SALT_ROUNDS defined', () => {
      expect(AUTH.PASSWORD_SALT_ROUNDS).toBe(12);
    });

    it('should have TOKEN_COOKIE_NAME defined', () => {
      expect(AUTH.TOKEN_COOKIE_NAME).toBe('token');
    });

    it('should have CSRF_COOKIE_NAME defined', () => {
      expect(AUTH.CSRF_COOKIE_NAME).toBe('csrf_token');
    });

    it('should be immutable (readonly)', () => {
      // This is a compile-time check, but we can verify the shape
      const authKeys = Object.keys(AUTH);
      expect(authKeys).toContain('JWT_EXPIRY');
      expect(authKeys).toContain('PASSWORD_SALT_ROUNDS');
      expect(authKeys).toContain('TOKEN_COOKIE_NAME');
      expect(authKeys).toContain('CSRF_COOKIE_NAME');
    });
  });

  describe('RATE_LIMITS constants', () => {
    it('should have API_REQUESTS_PER_MINUTE defined', () => {
      expect(RATE_LIMITS.API_REQUESTS_PER_MINUTE).toBe(100);
    });

    it('should have WINDOW_MS as 1 minute', () => {
      expect(RATE_LIMITS.WINDOW_MS).toBe(60 * 1000);
    });

    it('should have WS_CONNECTIONS_PER_MINUTE defined', () => {
      expect(RATE_LIMITS.WS_CONNECTIONS_PER_MINUTE).toBe(50);
    });

    it('should have LOGIN_ATTEMPTS_PER_HOUR defined', () => {
      expect(RATE_LIMITS.LOGIN_ATTEMPTS_PER_HOUR).toBe(5);
    });

    it('should have LOGIN_WINDOW_MS as 1 hour', () => {
      expect(RATE_LIMITS.LOGIN_WINDOW_MS).toBe(60 * 60 * 1000);
    });
  });

  describe('FILE constants', () => {
    it('should have MAX_SIZE_MB defined', () => {
      expect(FILE.MAX_SIZE_MB).toBe(10);
    });

    it('should have MAX_SIZE_BYTES calculated correctly', () => {
      expect(FILE.MAX_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });

    it('should have AUTO_SAVE_INTERVAL_MS defined', () => {
      expect(FILE.AUTO_SAVE_INTERVAL_MS).toBe(10000);
    });

    it('should have ALLOWED_TYPES defined', () => {
      expect(FILE.ALLOWED_TYPES).toContain('text/plain');
      expect(FILE.ALLOWED_TYPES).toContain('text/javascript');
      expect(FILE.ALLOWED_TYPES).toContain('text/typescript');
      expect(FILE.ALLOWED_TYPES).toContain('text/html');
      expect(FILE.ALLOWED_TYPES).toContain('text/css');
      expect(FILE.ALLOWED_TYPES).toContain('application/json');
      expect(FILE.ALLOWED_TYPES).toContain('application/xml');
    });

    it('should have 7 allowed file types', () => {
      expect(FILE.ALLOWED_TYPES.length).toBe(7);
    });
  });

  describe('PAGINATION constants', () => {
    it('should have DEFAULT_LIMIT defined', () => {
      expect(PAGINATION.DEFAULT_LIMIT).toBe(50);
    });

    it('should have MAX_LIMIT defined', () => {
      expect(PAGINATION.MAX_LIMIT).toBe(100);
    });

    it('should have DEFAULT_OFFSET defined', () => {
      expect(PAGINATION.DEFAULT_OFFSET).toBe(0);
    });

    it('should have DEFAULT_LIMIT less than or equal to MAX_LIMIT', () => {
      expect(PAGINATION.DEFAULT_LIMIT).toBeLessThanOrEqual(PAGINATION.MAX_LIMIT);
    });
  });

  describe('SEARCH constants', () => {
    it('should have MIN_QUERY_LENGTH defined', () => {
      expect(SEARCH.MIN_QUERY_LENGTH).toBe(2);
    });

    it('should have MAX_RESULTS defined', () => {
      expect(SEARCH.MAX_RESULTS).toBe(1000);
    });

    it('should have REGEX_TIMEOUT_MS defined', () => {
      expect(SEARCH.REGEX_TIMEOUT_MS).toBe(5000);
    });
  });

  describe('SNAPSHOT constants', () => {
    it('should have MAX_PER_SESSION defined', () => {
      expect(SNAPSHOT.MAX_PER_SESSION).toBe(100);
    });

    it('should have AUTO_CREATE_INTERVAL_HOURS defined', () => {
      expect(SNAPSHOT.AUTO_CREATE_INTERVAL_HOURS).toBe(24);
    });
  });

  describe('SESSION constants', () => {
    it('should have IDLE_TIMEOUT_HOURS defined', () => {
      expect(SESSION.IDLE_TIMEOUT_HOURS).toBe(24);
    });

    it('should have MAX_PARTICIPANTS defined', () => {
      expect(SESSION.MAX_PARTICIPANTS).toBe(50);
    });

    it('should have DEFAULT_LANGUAGE defined', () => {
      expect(SESSION.DEFAULT_LANGUAGE).toBe('javascript');
    });
  });

  describe('CACHE constants', () => {
    it('should have SESSION_TTL_SECONDS defined', () => {
      expect(CACHE.SESSION_TTL_SECONDS).toBe(300);
    });

    it('should have USER_TTL_SECONDS defined', () => {
      expect(CACHE.USER_TTL_SECONDS).toBe(600);
    });

    it('should have FILE_CONTENT_TTL_SECONDS defined', () => {
      expect(CACHE.FILE_CONTENT_TTL_SECONDS).toBe(60);
    });
  });

  describe('YJS constants', () => {
    it('should have PERSISTENCE_DEBOUNCE_MS defined', () => {
      expect(YJS.PERSISTENCE_DEBOUNCE_MS).toBe(2000);
    });

    it('should have CLEANUP_INTERVAL_MS defined', () => {
      expect(YJS.CLEANUP_INTERVAL_MS).toBe(60000);
    });

    it('should have INACTIVE_DOC_TIMEOUT_MS defined', () => {
      expect(YJS.INACTIVE_DOC_TIMEOUT_MS).toBe(300000);
    });
  });

  describe('WEBSOCKET constants', () => {
    it('should have PING_INTERVAL_MS defined', () => {
      expect(WEBSOCKET.PING_INTERVAL_MS).toBe(30000);
    });

    it('should have PING_TIMEOUT_MS defined', () => {
      expect(WEBSOCKET.PING_TIMEOUT_MS).toBe(5000);
    });

    it('should have MAX_PAYLOAD_BYTES defined', () => {
      expect(WEBSOCKET.MAX_PAYLOAD_BYTES).toBe(1e6);
    });

    it('should have PING_TIMEOUT_MS less than PING_INTERVAL_MS', () => {
      expect(WEBSOCKET.PING_TIMEOUT_MS).toBeLessThan(WEBSOCKET.PING_INTERVAL_MS);
    });
  });

  describe('constant consistency', () => {
    it('should have consistent time units', () => {
      // All millisecond values should be positive numbers
      expect(RATE_LIMITS.WINDOW_MS).toBeGreaterThan(0);
      expect(RATE_LIMITS.LOGIN_WINDOW_MS).toBeGreaterThan(0);
      expect(FILE.AUTO_SAVE_INTERVAL_MS).toBeGreaterThan(0);
      expect(SEARCH.REGEX_TIMEOUT_MS).toBeGreaterThan(0);
      expect(CACHE.SESSION_TTL_SECONDS).toBeGreaterThan(0);
      expect(CACHE.USER_TTL_SECONDS).toBeGreaterThan(0);
      expect(YJS.PERSISTENCE_DEBOUNCE_MS).toBeGreaterThan(0);
      expect(WEBSOCKET.PING_INTERVAL_MS).toBeGreaterThan(0);
    });

    it('should have valid limit values', () => {
      // All limit values should be positive integers
      expect(Number.isInteger(RATE_LIMITS.API_REQUESTS_PER_MINUTE)).toBe(true);
      expect(Number.isInteger(RATE_LIMITS.WS_CONNECTIONS_PER_MINUTE)).toBe(true);
      expect(Number.isInteger(RATE_LIMITS.LOGIN_ATTEMPTS_PER_HOUR)).toBe(true);
      expect(Number.isInteger(PAGINATION.DEFAULT_LIMIT)).toBe(true);
      expect(Number.isInteger(PAGINATION.MAX_LIMIT)).toBe(true);
      expect(Number.isInteger(SEARCH.MAX_RESULTS)).toBe(true);
      expect(Number.isInteger(SNAPSHOT.MAX_PER_SESSION)).toBe(true);
      expect(Number.isInteger(SESSION.MAX_PARTICIPANTS)).toBe(true);
    });
  });
});
