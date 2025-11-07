// Application constants
// Centralized configuration values

export const AUTH = {
  JWT_EXPIRY: '7d',
  PASSWORD_SALT_ROUNDS: 12,
  TOKEN_COOKIE_NAME: 'token',
  CSRF_COOKIE_NAME: 'csrf_token',
} as const;

export const RATE_LIMITS = {
  API_REQUESTS_PER_MINUTE: 100,
  WINDOW_MS: 60 * 1000, // 1 minute
  WS_CONNECTIONS_PER_MINUTE: 50,
  LOGIN_ATTEMPTS_PER_HOUR: 5,
  LOGIN_WINDOW_MS: 60 * 60 * 1000, // 1 hour
} as const;

export const FILE = {
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  AUTO_SAVE_INTERVAL_MS: 10000, // 10 seconds
  ALLOWED_TYPES: [
    'text/plain',
    'text/javascript',
    'text/typescript',
    'text/html',
    'text/css',
    'application/json',
    'application/xml',
  ],
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  DEFAULT_OFFSET: 0,
} as const;

export const SEARCH = {
  MIN_QUERY_LENGTH: 2,
  MAX_RESULTS: 1000,
  REGEX_TIMEOUT_MS: 5000,
} as const;

export const SNAPSHOT = {
  MAX_PER_SESSION: 100,
  AUTO_CREATE_INTERVAL_HOURS: 24,
} as const;

export const SESSION = {
  IDLE_TIMEOUT_HOURS: 24,
  MAX_PARTICIPANTS: 50,
  DEFAULT_LANGUAGE: 'javascript',
} as const;

export const CACHE = {
  SESSION_TTL_SECONDS: 300, // 5 minutes
  USER_TTL_SECONDS: 600, // 10 minutes
  FILE_CONTENT_TTL_SECONDS: 60, // 1 minute
} as const;

export const YJS = {
  PERSISTENCE_DEBOUNCE_MS: 2000,
  CLEANUP_INTERVAL_MS: 60000, // 1 minute
  INACTIVE_DOC_TIMEOUT_MS: 300000, // 5 minutes
} as const;

export const WEBSOCKET = {
  PING_INTERVAL_MS: 30000, // 30 seconds
  PING_TIMEOUT_MS: 5000, // 5 seconds
  MAX_PAYLOAD_BYTES: 1e6, // 1MB
} as const;
