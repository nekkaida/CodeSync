// Test utility functions
// Helper functions for common test operations

// Create a mock Express request
export const createMockRequest = (overrides: Partial<MockRequestOptions> = {}) => ({
  body: overrides.body || {},
  params: overrides.params || {},
  query: overrides.query || {},
  headers: overrides.headers || {},
  cookies: overrides.cookies || {},
  user: overrides.user,
  ip: overrides.ip || '127.0.0.1',
  method: overrides.method || 'GET',
  path: overrides.path || '/',
  originalUrl: overrides.path || '/',
  get: jest.fn((name: string) => {
    const headers = overrides.headers || {};
    return headers[name.toLowerCase()];
  }),
});

export interface MockRequestOptions {
  body: Record<string, unknown>;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  ip: string;
  method: string;
  path: string;
}

// Create a mock Express response
export const createMockResponse = (): MockResponse => {
  const res: MockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    locals: {},
  };
  return res;
};

export interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
  cookie: jest.Mock;
  clearCookie: jest.Mock;
  set: jest.Mock;
  setHeader: jest.Mock;
  end: jest.Mock;
  locals: Record<string, unknown>;
}

// Create a mock next function
export const createMockNext = (): jest.Mock<void, [unknown?]> => jest.fn();

// Wait for async operations
export const waitForAsync = (ms: number = 0): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

// Assert that a promise rejects with a specific error
export const expectToThrowAsync = async <T extends Error>(
  promise: Promise<unknown>,
  errorType: new (...args: unknown[]) => T,
  message?: string | RegExp,
): Promise<void> => {
  let thrownError: Error | undefined;

  try {
    await promise;
  } catch (error) {
    thrownError = error as Error;
  }

  expect(thrownError).toBeDefined();
  expect(thrownError).toBeInstanceOf(errorType);

  if (message) {
    if (typeof message === 'string') {
      expect(thrownError?.message).toContain(message);
    } else {
      expect(thrownError?.message).toMatch(message);
    }
  }
};

// Create a JWT-like token for testing
export const createTestToken = (payload: Record<string, unknown> = {}): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify({
    id: 'user-123',
    email: 'test@example.com',
    role: 'USER',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  })).toString('base64');
  const signature = 'testsignature';
  return `${header}.${body}.${signature}`;
};

// Generate random string
export const randomString = (length: number = 10): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Generate random email
export const randomEmail = (): string => `${randomString(8)}@example.com`;

// Generate valid password
export const validPassword = 'TestPassword123';

// Generate weak passwords for testing
export const weakPasswords = {
  tooShort: 'Pass1',
  noUppercase: 'password123',
  noLowercase: 'PASSWORD123',
  noNumber: 'PasswordAbc',
};

// Cleanup function to reset all mocks
export const resetAllMocks = (): void => {
  jest.clearAllMocks();
  jest.resetAllMocks();
};

// Deep clone an object
export const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

// Check if value is a valid date
export const isValidDate = (date: unknown): boolean => {
  if (date instanceof Date) {
    return !isNaN(date.getTime());
  }
  if (typeof date === 'string') {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }
  return false;
};

// Compare dates ignoring milliseconds
export const datesEqual = (date1: Date, date2: Date, toleranceMs: number = 1000): boolean => {
  return Math.abs(date1.getTime() - date2.getTime()) < toleranceMs;
};
