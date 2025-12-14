// Unit tests for session validators
// Tests all Zod schemas in src/validators/session.validator.ts

import {
  createSessionSchema,
  updateSessionSchema,
  getSessionSchema,
  listSessionsSchema,
  addParticipantSchema,
  removeParticipantSchema,
  updateCursorSchema,
} from '../../../validators/session.validator';
import { generateCuid } from '../../helpers/testData';

describe('Session Validators', () => {
  const validCuid = generateCuid();

  describe('createSessionSchema', () => {
    const validInput = {
      body: {
        name: 'Test Session',
        description: 'A test session description',
        language: 'javascript',
        visibility: 'PRIVATE',
      },
    };

    describe('valid inputs', () => {
      it('should accept valid session data', () => {
        const result = createSessionSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept session without description', () => {
        const input = {
          body: {
            name: 'Test Session',
            language: 'javascript',
            visibility: 'PRIVATE',
          },
        };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should trim name whitespace', () => {
        const input = { body: { ...validInput.body, name: '  Test Session  ' } };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.body.name).toBe('Test Session');
        }
      });

      it('should accept all valid programming languages', () => {
        const languages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp', 'csharp', 'php', 'ruby'];
        languages.forEach(language => {
          const input = { body: { ...validInput.body, language } };
          const result = createSessionSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });

      it('should accept all valid visibility options', () => {
        const visibilities = ['PUBLIC', 'PRIVATE', 'UNLISTED'];
        visibilities.forEach(visibility => {
          const input = { body: { ...validInput.body, visibility } };
          const result = createSessionSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });
    });

    describe('name validation', () => {
      it('should reject missing name', () => {
        const input = {
          body: {
            language: 'javascript',
            visibility: 'PRIVATE',
          },
        };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject name shorter than 3 characters', () => {
        const input = { body: { ...validInput.body, name: 'AB' } };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('3 characters');
        }
      });

      it('should reject name longer than 100 characters', () => {
        const input = { body: { ...validInput.body, name: 'A'.repeat(101) } };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('100 characters');
        }
      });

      it('should accept name at minimum length (3)', () => {
        const input = { body: { ...validInput.body, name: 'ABC' } };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept name at maximum length (100)', () => {
        const input = { body: { ...validInput.body, name: 'A'.repeat(100) } };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('description validation', () => {
      it('should reject description longer than 500 characters', () => {
        const input = { body: { ...validInput.body, description: 'A'.repeat(501) } };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('500 characters');
        }
      });

      it('should accept description at maximum length (500)', () => {
        const input = { body: { ...validInput.body, description: 'A'.repeat(500) } };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept empty description', () => {
        const input = { body: { ...validInput.body, description: '' } };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('language validation', () => {
      it('should reject invalid language', () => {
        const input = { body: { ...validInput.body, language: 'invalid' } };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('programming language');
        }
      });

      it('should reject missing language', () => {
        const input = {
          body: {
            name: 'Test Session',
            visibility: 'PRIVATE',
          },
        };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('visibility validation', () => {
      it('should reject invalid visibility', () => {
        const input = { body: { ...validInput.body, visibility: 'INVALID' } };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('visibility');
        }
      });

      it('should reject missing visibility', () => {
        const input = {
          body: {
            name: 'Test Session',
            language: 'javascript',
          },
        };
        const result = createSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('updateSessionSchema', () => {
    const validInput = {
      params: { sessionId: validCuid },
      body: {
        name: 'Updated Session',
      },
    };

    describe('valid inputs', () => {
      it('should accept valid update with name only', () => {
        const result = updateSessionSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept partial updates', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { description: 'New description' },
        };
        const result = updateSessionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept all valid status options', () => {
        const statuses = ['ACTIVE', 'ARCHIVED', 'PAUSED'];
        statuses.forEach(status => {
          const input = {
            params: { sessionId: validCuid },
            body: { status },
          };
          const result = updateSessionSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });

      it('should accept empty body', () => {
        const input = {
          params: { sessionId: validCuid },
          body: {},
        };
        const result = updateSessionSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('params validation', () => {
      it('should reject invalid session ID format', () => {
        const input = {
          params: { sessionId: 'invalid-id' },
          body: { name: 'Updated' },
        };
        const result = updateSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('session ID');
        }
      });

      it('should reject missing session ID', () => {
        const input = {
          params: {},
          body: { name: 'Updated' },
        };
        const result = updateSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('body validation', () => {
      it('should validate name if provided', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { name: 'AB' }, // too short
        };
        const result = updateSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should validate language if provided', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { language: 'invalid' },
        };
        const result = updateSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should validate visibility if provided', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { visibility: 'INVALID' },
        };
        const result = updateSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should validate status if provided', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { status: 'INVALID' },
        };
        const result = updateSessionSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('getSessionSchema', () => {
    it('should accept valid session ID', () => {
      const input = { params: { sessionId: validCuid } };
      const result = getSessionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid session ID', () => {
      const input = { params: { sessionId: 'invalid' } };
      const result = getSessionSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing session ID', () => {
      const input = { params: {} };
      const result = getSessionSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('listSessionsSchema', () => {
    describe('valid inputs', () => {
      it('should accept empty query', () => {
        const input = { query: {} };
        const result = listSessionsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept all filter options', () => {
        const input = {
          query: {
            visibility: 'PUBLIC',
            language: 'javascript',
            status: 'ACTIVE',
            limit: '50',
            offset: '10',
          },
        };
        const result = listSessionsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should coerce string numbers to integers', () => {
        const input = { query: { limit: '25', offset: '5' } };
        const result = listSessionsSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query.limit).toBe(25);
          expect(result.data.query.offset).toBe(5);
        }
      });

      it('should use default values', () => {
        const input = { query: {} };
        const result = listSessionsSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query.limit).toBe(20);
          expect(result.data.query.offset).toBe(0);
        }
      });
    });

    describe('pagination validation', () => {
      it('should reject limit less than 1', () => {
        const input = { query: { limit: '0' } };
        const result = listSessionsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject limit greater than 100', () => {
        const input = { query: { limit: '101' } };
        const result = listSessionsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should accept limit at boundaries (1 and 100)', () => {
        const input1 = { query: { limit: '1' } };
        const input100 = { query: { limit: '100' } };
        expect(listSessionsSchema.safeParse(input1).success).toBe(true);
        expect(listSessionsSchema.safeParse(input100).success).toBe(true);
      });

      it('should reject negative offset', () => {
        const input = { query: { offset: '-1' } };
        const result = listSessionsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should accept zero offset', () => {
        const input = { query: { offset: '0' } };
        const result = listSessionsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('filter validation', () => {
      it('should reject invalid visibility', () => {
        const input = { query: { visibility: 'INVALID' } };
        const result = listSessionsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject invalid language', () => {
        const input = { query: { language: 'invalid' } };
        const result = listSessionsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject invalid status', () => {
        const input = { query: { status: 'INVALID' } };
        const result = listSessionsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('addParticipantSchema', () => {
    const validInput = {
      params: { sessionId: validCuid },
      body: { userId: validCuid, role: 'VIEWER' },
    };

    describe('valid inputs', () => {
      it('should accept valid participant data', () => {
        const result = addParticipantSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept all valid roles', () => {
        const roles = ['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER'];
        roles.forEach(role => {
          const input = {
            params: { sessionId: validCuid },
            body: { userId: validCuid, role },
          };
          const result = addParticipantSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });
    });

    describe('params validation', () => {
      it('should reject invalid session ID', () => {
        const input = {
          params: { sessionId: 'invalid' },
          body: { userId: validCuid, role: 'VIEWER' },
        };
        const result = addParticipantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('body validation', () => {
      it('should reject invalid user ID', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { userId: 'invalid', role: 'VIEWER' },
        };
        const result = addParticipantSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('user ID');
        }
      });

      it('should reject invalid role', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { userId: validCuid, role: 'INVALID' },
        };
        const result = addParticipantSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('role');
        }
      });

      it('should reject missing role', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { userId: validCuid },
        };
        const result = addParticipantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject missing userId', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { role: 'VIEWER' },
        };
        const result = addParticipantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('removeParticipantSchema', () => {
    const validInput = {
      params: {
        sessionId: validCuid,
        userId: validCuid,
      },
    };

    it('should accept valid params', () => {
      const result = removeParticipantSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid session ID', () => {
      const input = {
        params: { sessionId: 'invalid', userId: validCuid },
      };
      const result = removeParticipantSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid user ID', () => {
      const input = {
        params: { sessionId: validCuid, userId: 'invalid' },
      };
      const result = removeParticipantSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing params', () => {
      const input = { params: {} };
      const result = removeParticipantSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateCursorSchema', () => {
    const validInput = {
      params: { sessionId: validCuid },
      body: { line: 10, column: 5 },
    };

    describe('valid inputs', () => {
      it('should accept valid cursor position', () => {
        const result = updateCursorSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept zero line and column', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { line: 0, column: 0 },
        };
        const result = updateCursorSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept large line and column numbers', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { line: 100000, column: 10000 },
        };
        const result = updateCursorSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('params validation', () => {
      it('should reject invalid session ID', () => {
        const input = {
          params: { sessionId: 'invalid' },
          body: { line: 10, column: 5 },
        };
        const result = updateCursorSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('body validation', () => {
      it('should reject negative line number', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { line: -1, column: 5 },
        };
        const result = updateCursorSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject negative column number', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { line: 10, column: -1 },
        };
        const result = updateCursorSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject non-integer line number', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { line: 10.5, column: 5 },
        };
        const result = updateCursorSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject non-integer column number', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { line: 10, column: 5.5 },
        };
        const result = updateCursorSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject missing line', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { column: 5 },
        };
        const result = updateCursorSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject missing column', () => {
        const input = {
          params: { sessionId: validCuid },
          body: { line: 10 },
        };
        const result = updateCursorSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });
});
