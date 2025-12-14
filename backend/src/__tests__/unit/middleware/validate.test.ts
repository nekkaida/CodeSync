// Validation middleware tests
// Tests Zod schema validation middleware

import { z } from 'zod';
import { validate } from '../../../middleware/validate';
import { ValidationError } from '../../../utils/errors';
import { createMockRequest, createMockResponse, createMockNext } from '../../helpers/testUtils';

describe('validate Middleware', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('with valid input', () => {
    it('should call next() when body is valid', async () => {
      const schema = z.object({
        body: z.object({
          name: z.string().min(1),
          email: z.string().email(),
        }),
      });

      mockReq = createMockRequest({
        body: { name: 'John', email: 'john@example.com' },
      });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should call next() when params are valid', async () => {
      const schema = z.object({
        params: z.object({
          id: z.string().cuid(),
        }),
      });

      mockReq = createMockRequest({
        params: { id: 'clk1234567890abcdefghij12' },
      });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next() when query is valid', async () => {
      const schema = z.object({
        query: z.object({
          page: z.string().optional(),
          limit: z.string().optional(),
        }),
      });

      mockReq = createMockRequest({
        query: { page: '1', limit: '10' },
      });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next() with combined body, params, and query', async () => {
      const schema = z.object({
        body: z.object({ name: z.string() }),
        params: z.object({ id: z.string() }),
        query: z.object({ include: z.string().optional() }),
      });

      mockReq = createMockRequest({
        body: { name: 'Test' },
        params: { id: '123' },
        query: { include: 'relations' },
      });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('with invalid input', () => {
    it('should call next with ValidationError for invalid body', async () => {
      const schema = z.object({
        body: z.object({
          email: z.string().email('Invalid email'),
        }),
      });

      mockReq = createMockRequest({
        body: { email: 'not-an-email' },
      });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toContain('Invalid email');
    });

    it('should call next with ValidationError for missing required field', async () => {
      const schema = z.object({
        body: z.object({
          name: z.string({ required_error: 'Name is required' }),
        }),
      });

      mockReq = createMockRequest({
        body: {},
      });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should include all validation error messages', async () => {
      const schema = z.object({
        body: z.object({
          name: z.string().min(2, 'Name too short'),
          email: z.string().email('Invalid email'),
          age: z.number().min(0, 'Age must be positive'),
        }),
      });

      mockReq = createMockRequest({
        body: { name: 'A', email: 'bad', age: -5 },
      });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.message).toContain('Name too short');
      expect(error.message).toContain('Invalid email');
      expect(error.message).toContain('Age must be positive');
    });

    it('should handle invalid params', async () => {
      const schema = z.object({
        params: z.object({
          id: z.string().cuid('Invalid ID format'),
        }),
      });

      mockReq = createMockRequest({
        params: { id: 'invalid-id' },
      });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should handle wrong type', async () => {
      const schema = z.object({
        body: z.object({
          count: z.number(),
        }),
      });

      mockReq = createMockRequest({
        body: { count: 'not-a-number' },
      });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('error handling', () => {
    it('should pass non-Zod errors through', async () => {
      // Create a schema that throws a non-Zod error
      const faultySchema = {
        parseAsync: jest.fn().mockRejectedValue(new Error('Unexpected error')),
      };

      const middleware = validate(faultySchema as any);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      const error = mockNext.mock.calls[0][0];
      expect(error).not.toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Unexpected error');
    });
  });

  describe('edge cases', () => {
    it('should handle empty body', async () => {
      const schema = z.object({
        body: z.object({}).optional(),
      });

      mockReq = createMockRequest({ body: {} });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle undefined values', async () => {
      const schema = z.object({
        body: z.object({
          optional: z.string().optional(),
        }),
      });

      mockReq = createMockRequest({
        body: { optional: undefined },
      });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle nested validation', async () => {
      const schema = z.object({
        body: z.object({
          user: z.object({
            profile: z.object({
              name: z.string().min(1),
            }),
          }),
        }),
      });

      mockReq = createMockRequest({
        body: {
          user: {
            profile: {
              name: '',
            },
          },
        },
      });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should handle array validation', async () => {
      const schema = z.object({
        body: z.object({
          tags: z.array(z.string()).min(1, 'At least one tag required'),
        }),
      });

      mockReq = createMockRequest({
        body: { tags: [] },
      });

      const middleware = validate(schema);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toContain('At least one tag required');
    });
  });
});
