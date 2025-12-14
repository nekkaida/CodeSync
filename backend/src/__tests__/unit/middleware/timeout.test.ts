// Timeout middleware tests
// Tests request timeout handling

import { Request, Response } from 'express';
import { requestTimeout } from '../../../middleware/timeout';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  log: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('requestTimeout middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let finishHandlers: (() => void)[];
  let closeHandlers: (() => void)[];

  beforeEach(() => {
    jest.useFakeTimers();
    finishHandlers = [];
    closeHandlers = [];
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockReq = {
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1',
    };
    mockRes = {
      status: statusMock,
      json: jsonMock,
      headersSent: false,
      on: jest.fn((event: string, handler: () => void) => {
        if (event === 'finish') finishHandlers.push(handler);
        if (event === 'close') closeHandlers.push(handler);
        return mockRes as Response;
      }) as any,
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should call next() immediately', () => {
    const middleware = requestTimeout();
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('should use default timeout of 30 seconds', () => {
    const middleware = requestTimeout();
    middleware(mockReq as Request, mockRes as Response, mockNext);

    // Advance time just under 30 seconds
    jest.advanceTimersByTime(29999);
    expect(statusMock).not.toHaveBeenCalled();

    // Advance past 30 seconds
    jest.advanceTimersByTime(2);
    expect(statusMock).toHaveBeenCalledWith(408);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Request timeout',
        code: 'REQUEST_TIMEOUT',
        statusCode: 408,
      },
    });
  });

  it('should use custom timeout value', () => {
    const middleware = requestTimeout({ timeout: 5000 });
    middleware(mockReq as Request, mockRes as Response, mockNext);

    jest.advanceTimersByTime(4999);
    expect(statusMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2);
    expect(statusMock).toHaveBeenCalledWith(408);
  });

  it('should clear timeout on response finish', () => {
    const middleware = requestTimeout({ timeout: 1000 });
    middleware(mockReq as Request, mockRes as Response, mockNext);

    // Simulate response finish before timeout
    finishHandlers.forEach((handler) => handler());

    // Advance past timeout
    jest.advanceTimersByTime(2000);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('should clear timeout on response close', () => {
    const middleware = requestTimeout({ timeout: 1000 });
    middleware(mockReq as Request, mockRes as Response, mockNext);

    // Simulate response close before timeout
    closeHandlers.forEach((handler) => handler());

    // Advance past timeout
    jest.advanceTimersByTime(2000);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('should not send response if headers already sent', () => {
    const middleware = requestTimeout({ timeout: 1000 });
    middleware(mockReq as Request, mockRes as Response, mockNext);

    // Simulate headers already sent
    (mockRes as any).headersSent = true;

    jest.advanceTimersByTime(2000);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('should call custom onTimeout handler', () => {
    const customHandler = jest.fn();
    const middleware = requestTimeout({
      timeout: 1000,
      onTimeout: customHandler,
    });
    middleware(mockReq as Request, mockRes as Response, mockNext);

    jest.advanceTimersByTime(1001);

    expect(customHandler).toHaveBeenCalledWith(mockReq, mockRes);
    expect(statusMock).not.toHaveBeenCalled(); // Custom handler should manage response
  });

  it('should register finish and close event listeners', () => {
    const middleware = requestTimeout();
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(mockRes.on).toHaveBeenCalledWith('close', expect.any(Function));
  });
});
