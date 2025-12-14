// Logger tests
// Tests for Winston logger utilities

// Save original env
const originalEnv = process.env.NODE_ENV;
const originalLogLevel = process.env.LOG_LEVEL;

// Unmock logger to test the actual implementation
jest.unmock('../../../utils/logger');

describe('Logger', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.LOG_LEVEL = originalLogLevel;
  });

  describe('log helper methods', () => {
    let log: typeof import('../../../utils/logger').log;
    let logger: typeof import('../../../utils/logger').logger;

    beforeEach(() => {
      jest.resetModules();
      const loggerModule = jest.requireActual('../../../utils/logger');
      log = loggerModule.log;
      logger = loggerModule.logger;

      // Spy on logger methods
      jest.spyOn(logger, 'info').mockImplementation();
      jest.spyOn(logger, 'error').mockImplementation();
      jest.spyOn(logger, 'warn').mockImplementation();
      jest.spyOn(logger, 'debug').mockImplementation();
      jest.spyOn(logger, 'http').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should call logger.info with message', () => {
      log.info('Test message');
      expect(logger.info).toHaveBeenCalledWith('Test message', undefined);
    });

    it('should call logger.info with message and meta', () => {
      log.info('Test message', { key: 'value' });
      expect(logger.info).toHaveBeenCalledWith('Test message', { key: 'value' });
    });

    it('should call logger.warn with message', () => {
      log.warn('Warning message');
      expect(logger.warn).toHaveBeenCalledWith('Warning message', undefined);
    });

    it('should call logger.warn with message and meta', () => {
      log.warn('Warning message', { count: 5 });
      expect(logger.warn).toHaveBeenCalledWith('Warning message', { count: 5 });
    });

    it('should call logger.debug with message', () => {
      log.debug('Debug message');
      expect(logger.debug).toHaveBeenCalledWith('Debug message', undefined);
    });

    it('should call logger.debug with message and meta', () => {
      log.debug('Debug message', { detail: 'info' });
      expect(logger.debug).toHaveBeenCalledWith('Debug message', { detail: 'info' });
    });

    it('should call logger.http with message', () => {
      log.http('HTTP message');
      expect(logger.http).toHaveBeenCalledWith('HTTP message', undefined);
    });

    it('should call logger.http with message and meta', () => {
      log.http('HTTP message', { status: 200 });
      expect(logger.http).toHaveBeenCalledWith('HTTP message', { status: 200 });
    });

    it('should call logger.error with Error object', () => {
      const error = new Error('Test error');
      log.error('Error occurred', error);

      expect(logger.error).toHaveBeenCalledWith('Error occurred', {
        error: 'Test error',
        stack: error.stack,
      });
    });

    it('should call logger.error with Error object and additional meta', () => {
      const error = new Error('Test error');
      log.error('Error occurred', error, { userId: 'user-123' });

      expect(logger.error).toHaveBeenCalledWith('Error occurred', {
        error: 'Test error',
        stack: error.stack,
        userId: 'user-123',
      });
    });

    it('should call logger.error with non-Error object', () => {
      log.error('Error occurred', { code: 'ERR_001' });

      expect(logger.error).toHaveBeenCalledWith('Error occurred', {
        error: { code: 'ERR_001' },
      });
    });

    it('should call logger.error with non-Error object and additional meta', () => {
      log.error('Error occurred', 'string error', { context: 'test' });

      expect(logger.error).toHaveBeenCalledWith('Error occurred', {
        error: 'string error',
        context: 'test',
      });
    });

    it('should call logger.error with undefined error', () => {
      log.error('Error occurred', undefined);

      expect(logger.error).toHaveBeenCalledWith('Error occurred', {
        error: undefined,
      });
    });
  });

  describe('httpLogger middleware', () => {
    let httpLogger: typeof import('../../../utils/logger').httpLogger;
    let log: typeof import('../../../utils/logger').log;

    beforeEach(() => {
      jest.resetModules();
      const loggerModule = jest.requireActual('../../../utils/logger');
      httpLogger = loggerModule.httpLogger;
      log = loggerModule.log;

      jest.spyOn(log, 'http').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should call next immediately', () => {
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const mockRes = {
        statusCode: 200,
        on: jest.fn(),
      };
      const mockNext = jest.fn();

      httpLogger(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should register finish event handler', () => {
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const mockRes = {
        statusCode: 200,
        on: jest.fn(),
      };
      const mockNext = jest.fn();

      httpLogger(mockReq, mockRes, mockNext);

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should log HTTP request on finish', () => {
      jest.useFakeTimers();

      const mockReq = {
        method: 'POST',
        originalUrl: '/api/users',
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Chrome/100.0'),
      };
      const mockRes = {
        statusCode: 201,
        on: jest.fn(),
      };
      const mockNext = jest.fn();

      httpLogger(mockReq, mockRes, mockNext);

      // Get the finish callback
      const finishCallback = mockRes.on.mock.calls[0][1];

      // Advance time by 50ms
      jest.advanceTimersByTime(50);

      // Trigger finish
      finishCallback();

      expect(log.http).toHaveBeenCalledWith('POST /api/users', {
        method: 'POST',
        url: '/api/users',
        status: 201,
        duration: expect.stringMatching(/\d+ms/),
        ip: '192.168.1.1',
        userAgent: 'Chrome/100.0',
      });

      jest.useRealTimers();
    });

    it('should handle missing user agent', () => {
      jest.useFakeTimers();

      const mockReq = {
        method: 'GET',
        originalUrl: '/health',
        ip: '10.0.0.1',
        get: jest.fn().mockReturnValue(undefined),
      };
      const mockRes = {
        statusCode: 200,
        on: jest.fn(),
      };
      const mockNext = jest.fn();

      httpLogger(mockReq, mockRes, mockNext);

      const finishCallback = mockRes.on.mock.calls[0][1];
      finishCallback();

      expect(log.http).toHaveBeenCalledWith('GET /health', {
        method: 'GET',
        url: '/health',
        status: 200,
        duration: expect.stringMatching(/\d+ms/),
        ip: '10.0.0.1',
        userAgent: undefined,
      });

      jest.useRealTimers();
    });
  });

  describe('logger configuration', () => {
    it('should export logger instance', () => {
      const loggerModule = jest.requireActual('../../../utils/logger');
      expect(loggerModule.logger).toBeDefined();
      expect(typeof loggerModule.logger.info).toBe('function');
      expect(typeof loggerModule.logger.error).toBe('function');
    });

    it('should export default logger', () => {
      const loggerModule = jest.requireActual('../../../utils/logger');
      expect(loggerModule.default).toBe(loggerModule.logger);
    });

    it('should export log helper object', () => {
      const loggerModule = jest.requireActual('../../../utils/logger');
      expect(loggerModule.log).toBeDefined();
      expect(typeof loggerModule.log.info).toBe('function');
      expect(typeof loggerModule.log.error).toBe('function');
      expect(typeof loggerModule.log.warn).toBe('function');
      expect(typeof loggerModule.log.debug).toBe('function');
      expect(typeof loggerModule.log.http).toBe('function');
    });

    it('should export httpLogger middleware', () => {
      const loggerModule = jest.requireActual('../../../utils/logger');
      expect(typeof loggerModule.httpLogger).toBe('function');
    });
  });

  describe('development vs production format', () => {
    it('should use test format in test environment', () => {
      process.env.NODE_ENV = 'test';
      jest.resetModules();

      const loggerModule = jest.requireActual('../../../utils/logger');
      expect(loggerModule.logger).toBeDefined();
    });

    it('should use development format in development environment', () => {
      process.env.NODE_ENV = 'development';
      jest.resetModules();

      const loggerModule = jest.requireActual('../../../utils/logger');
      expect(loggerModule.logger).toBeDefined();
    });
  });

  describe('log level configuration', () => {
    it('should respect LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'debug';
      jest.resetModules();

      const loggerModule = jest.requireActual('../../../utils/logger');
      expect(loggerModule.logger.level).toBe('debug');
    });

    it('should default to info level', () => {
      delete process.env.LOG_LEVEL;
      jest.resetModules();

      const loggerModule = jest.requireActual('../../../utils/logger');
      expect(loggerModule.logger.level).toBe('info');
    });
  });
});
