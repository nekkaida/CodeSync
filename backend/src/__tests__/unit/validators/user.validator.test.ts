// Unit tests for user validators
// Tests all Zod schemas in src/validators/user.validator.ts

import {
  getUserSchema,
  updateUserSchema,
  listUsersSchema,
  updateRoleSchema,
  getUserSessionsSchema,
  getAIUsageSchema,
  getAuditLogSchema,
} from '../../../validators/user.validator';
import { generateCuid } from '../../helpers/testData';

describe('User Validators', () => {
  const validCuid = generateCuid();

  describe('getUserSchema', () => {
    it('should accept valid user ID', () => {
      const input = { params: { userId: validCuid } };
      const result = getUserSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid user ID format', () => {
      const input = { params: { userId: 'invalid-id' } };
      const result = getUserSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('user ID');
      }
    });

    it('should reject missing user ID', () => {
      const input = { params: {} };
      const result = getUserSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty user ID', () => {
      const input = { params: { userId: '' } };
      const result = getUserSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateUserSchema', () => {
    describe('valid inputs', () => {
      it('should accept valid update with name', () => {
        const input = {
          params: { userId: validCuid },
          body: { name: 'New Name' },
        };
        const result = updateUserSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept valid update with ai_cost_limit', () => {
        const input = {
          params: { userId: validCuid },
          body: { ai_cost_limit: 50 },
        };
        const result = updateUserSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept empty body', () => {
        const input = {
          params: { userId: validCuid },
          body: {},
        };
        const result = updateUserSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept both name and ai_cost_limit', () => {
        const input = {
          params: { userId: validCuid },
          body: { name: 'New Name', ai_cost_limit: 75 },
        };
        const result = updateUserSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should trim name whitespace', () => {
        const input = {
          params: { userId: validCuid },
          body: { name: '  New Name  ' },
        };
        const result = updateUserSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.body.name).toBe('New Name');
        }
      });
    });

    describe('params validation', () => {
      it('should reject invalid user ID', () => {
        const input = {
          params: { userId: 'invalid' },
          body: { name: 'Test' },
        };
        const result = updateUserSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('name validation', () => {
      it('should reject name shorter than 2 characters', () => {
        const input = {
          params: { userId: validCuid },
          body: { name: 'A' },
        };
        const result = updateUserSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('2 characters');
        }
      });

      it('should reject name longer than 100 characters', () => {
        const input = {
          params: { userId: validCuid },
          body: { name: 'A'.repeat(101) },
        };
        const result = updateUserSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('100 characters');
        }
      });

      it('should accept name at boundary lengths', () => {
        const input2 = {
          params: { userId: validCuid },
          body: { name: 'AB' },
        };
        const input100 = {
          params: { userId: validCuid },
          body: { name: 'A'.repeat(100) },
        };
        expect(updateUserSchema.safeParse(input2).success).toBe(true);
        expect(updateUserSchema.safeParse(input100).success).toBe(true);
      });
    });

    describe('ai_cost_limit validation', () => {
      it('should reject negative ai_cost_limit', () => {
        const input = {
          params: { userId: validCuid },
          body: { ai_cost_limit: -1 },
        };
        const result = updateUserSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('non-negative');
        }
      });

      it('should reject ai_cost_limit exceeding 1000', () => {
        const input = {
          params: { userId: validCuid },
          body: { ai_cost_limit: 1001 },
        };
        const result = updateUserSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('1000');
        }
      });

      it('should accept ai_cost_limit at boundary values', () => {
        const input0 = {
          params: { userId: validCuid },
          body: { ai_cost_limit: 0 },
        };
        const input1000 = {
          params: { userId: validCuid },
          body: { ai_cost_limit: 1000 },
        };
        expect(updateUserSchema.safeParse(input0).success).toBe(true);
        expect(updateUserSchema.safeParse(input1000).success).toBe(true);
      });

      it('should accept decimal ai_cost_limit', () => {
        const input = {
          params: { userId: validCuid },
          body: { ai_cost_limit: 50.5 },
        };
        const result = updateUserSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('listUsersSchema', () => {
    describe('valid inputs', () => {
      it('should accept empty query', () => {
        const input = { query: {} };
        const result = listUsersSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept all valid roles', () => {
        const roles = ['USER', 'ADMIN', 'MODERATOR'];
        roles.forEach(role => {
          const input = { query: { role } };
          const result = listUsersSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });

      it('should accept pagination params', () => {
        const input = { query: { limit: '25', offset: '10' } };
        const result = listUsersSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query.limit).toBe(25);
          expect(result.data.query.offset).toBe(10);
        }
      });

      it('should use default pagination values', () => {
        const input = { query: {} };
        const result = listUsersSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query.limit).toBe(50);
          expect(result.data.query.offset).toBe(0);
        }
      });
    });

    describe('role validation', () => {
      it('should reject invalid role', () => {
        const input = { query: { role: 'INVALID' } };
        const result = listUsersSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('pagination validation', () => {
      it('should reject limit less than 1', () => {
        const input = { query: { limit: '0' } };
        const result = listUsersSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject limit greater than 100', () => {
        const input = { query: { limit: '101' } };
        const result = listUsersSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject negative offset', () => {
        const input = { query: { offset: '-1' } };
        const result = listUsersSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('updateRoleSchema', () => {
    describe('valid inputs', () => {
      it('should accept valid role update', () => {
        const input = {
          params: { userId: validCuid },
          body: { role: 'ADMIN' },
        };
        const result = updateRoleSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept all valid roles', () => {
        const roles = ['USER', 'ADMIN', 'MODERATOR'];
        roles.forEach(role => {
          const input = {
            params: { userId: validCuid },
            body: { role },
          };
          const result = updateRoleSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });
    });

    describe('params validation', () => {
      it('should reject invalid user ID', () => {
        const input = {
          params: { userId: 'invalid' },
          body: { role: 'ADMIN' },
        };
        const result = updateRoleSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('body validation', () => {
      it('should reject invalid role', () => {
        const input = {
          params: { userId: validCuid },
          body: { role: 'INVALID' },
        };
        const result = updateRoleSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('role');
        }
      });

      it('should reject missing role', () => {
        const input = {
          params: { userId: validCuid },
          body: {},
        };
        const result = updateRoleSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('getUserSessionsSchema', () => {
    describe('valid inputs', () => {
      it('should accept valid params and query', () => {
        const input = {
          params: { userId: validCuid },
          query: { limit: '10', offset: '5' },
        };
        const result = getUserSessionsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept empty query', () => {
        const input = {
          params: { userId: validCuid },
          query: {},
        };
        const result = getUserSessionsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should use default pagination', () => {
        const input = {
          params: { userId: validCuid },
          query: {},
        };
        const result = getUserSessionsSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query.limit).toBe(20);
          expect(result.data.query.offset).toBe(0);
        }
      });
    });

    describe('params validation', () => {
      it('should reject invalid user ID', () => {
        const input = {
          params: { userId: 'invalid' },
          query: {},
        };
        const result = getUserSessionsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('pagination validation', () => {
      it('should reject invalid limit', () => {
        const input = {
          params: { userId: validCuid },
          query: { limit: '0' },
        };
        const result = getUserSessionsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject limit over 100', () => {
        const input = {
          params: { userId: validCuid },
          query: { limit: '101' },
        };
        const result = getUserSessionsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('getAIUsageSchema', () => {
    describe('valid inputs', () => {
      it('should accept valid params and query', () => {
        const input = {
          params: { userId: validCuid },
          query: { days: '30' },
        };
        const result = getAIUsageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept empty query (uses default)', () => {
        const input = {
          params: { userId: validCuid },
          query: {},
        };
        const result = getAIUsageSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query.days).toBe(30);
        }
      });
    });

    describe('params validation', () => {
      it('should reject invalid user ID', () => {
        const input = {
          params: { userId: 'invalid' },
          query: {},
        };
        const result = getAIUsageSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('days validation', () => {
      it('should reject days less than 1', () => {
        const input = {
          params: { userId: validCuid },
          query: { days: '0' },
        };
        const result = getAIUsageSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject days greater than 365', () => {
        const input = {
          params: { userId: validCuid },
          query: { days: '366' },
        };
        const result = getAIUsageSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should accept days at boundary values', () => {
        const input1 = {
          params: { userId: validCuid },
          query: { days: '1' },
        };
        const input365 = {
          params: { userId: validCuid },
          query: { days: '365' },
        };
        expect(getAIUsageSchema.safeParse(input1).success).toBe(true);
        expect(getAIUsageSchema.safeParse(input365).success).toBe(true);
      });
    });
  });

  describe('getAuditLogSchema', () => {
    describe('valid inputs', () => {
      it('should accept valid params and query', () => {
        const input = {
          params: { userId: validCuid },
          query: { limit: '25', offset: '10' },
        };
        const result = getAuditLogSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept empty query (uses defaults)', () => {
        const input = {
          params: { userId: validCuid },
          query: {},
        };
        const result = getAuditLogSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query.limit).toBe(50);
          expect(result.data.query.offset).toBe(0);
        }
      });
    });

    describe('params validation', () => {
      it('should reject invalid user ID', () => {
        const input = {
          params: { userId: 'invalid' },
          query: {},
        };
        const result = getAuditLogSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('pagination validation', () => {
      it('should reject limit less than 1', () => {
        const input = {
          params: { userId: validCuid },
          query: { limit: '0' },
        };
        const result = getAuditLogSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject limit greater than 100', () => {
        const input = {
          params: { userId: validCuid },
          query: { limit: '101' },
        };
        const result = getAuditLogSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject negative offset', () => {
        const input = {
          params: { userId: validCuid },
          query: { offset: '-1' },
        };
        const result = getAuditLogSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });
});
