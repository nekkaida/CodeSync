// Unit tests for invitation validators
// Tests all Zod schemas in src/validators/invitation.validator.ts

import {
  createInvitationSchema,
  listInvitationsSchema,
  acceptInvitationSchema,
} from '../../../validators/invitation.validator';
import { generateCuid } from '../../helpers/testData';

describe('Invitation Validators', () => {
  const validCuid = generateCuid();

  describe('createInvitationSchema', () => {
    const validInput = {
      body: {
        sessionId: validCuid,
        email: 'invitee@example.com',
        role: 'VIEWER',
      },
    };

    describe('valid inputs', () => {
      it('should accept valid invitation data', () => {
        const result = createInvitationSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept invitation without role (uses default)', () => {
        const input = {
          body: {
            sessionId: validCuid,
            email: 'invitee@example.com',
          },
        };
        const result = createInvitationSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.body.role).toBe('VIEWER');
        }
      });

      it('should accept all valid participant roles', () => {
        const roles = ['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER'];
        roles.forEach(role => {
          const input = { body: { ...validInput.body, role } };
          const result = createInvitationSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });

      it('should accept various valid email formats', () => {
        const emails = [
          'test@example.com',
          'user.name@domain.org',
          'user+tag@example.co.uk',
          'test123@sub.domain.com',
        ];
        emails.forEach(email => {
          const input = { body: { ...validInput.body, email } };
          const result = createInvitationSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });
    });

    describe('sessionId validation', () => {
      it('should reject invalid session ID', () => {
        const input = {
          body: {
            sessionId: 'invalid-id',
            email: 'test@example.com',
          },
        };
        const result = createInvitationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject missing session ID', () => {
        const input = {
          body: {
            email: 'test@example.com',
          },
        };
        const result = createInvitationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject empty session ID', () => {
        const input = {
          body: {
            sessionId: '',
            email: 'test@example.com',
          },
        };
        const result = createInvitationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('email validation', () => {
      it('should reject invalid email format', () => {
        const invalidEmails = [
          'notanemail',
          '@example.com',
          'test@',
          'test@.com',
          'test@example',
          '',
        ];
        invalidEmails.forEach(email => {
          const input = { body: { ...validInput.body, email } };
          const result = createInvitationSchema.safeParse(input);
          expect(result.success).toBe(false);
        });
      });

      it('should reject missing email', () => {
        const input = {
          body: {
            sessionId: validCuid,
          },
        };
        const result = createInvitationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('role validation', () => {
      it('should reject invalid role', () => {
        const input = {
          body: {
            ...validInput.body,
            role: 'INVALID_ROLE',
          },
        };
        const result = createInvitationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should use VIEWER as default role', () => {
        const input = {
          body: {
            sessionId: validCuid,
            email: 'test@example.com',
          },
        };
        const result = createInvitationSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.body.role).toBe('VIEWER');
        }
      });
    });
  });

  describe('listInvitationsSchema', () => {
    describe('valid inputs', () => {
      it('should accept valid session ID', () => {
        const input = {
          params: { sessionId: validCuid },
        };
        const result = listInvitationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('params validation', () => {
      it('should reject invalid session ID', () => {
        const input = {
          params: { sessionId: 'invalid' },
        };
        const result = listInvitationsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject missing session ID', () => {
        const input = {
          params: {},
        };
        const result = listInvitationsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject empty session ID', () => {
        const input = {
          params: { sessionId: '' },
        };
        const result = listInvitationsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('acceptInvitationSchema', () => {
    const validInput = {
      params: { token: 'valid-invitation-token' },
      body: { email: 'accepter@example.com' },
    };

    describe('valid inputs', () => {
      it('should accept valid token and email', () => {
        const result = acceptInvitationSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept without email (optional)', () => {
        const input = {
          params: { token: 'valid-token' },
          body: {},
        };
        const result = acceptInvitationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept long token', () => {
        const input = {
          params: { token: 'a'.repeat(100) },
          body: {},
        };
        const result = acceptInvitationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept various token formats', () => {
        const tokens = [
          'abc123',
          'TOKEN-WITH-DASHES',
          'token_with_underscores',
          'MixedCase123Token',
        ];
        tokens.forEach(token => {
          const input = {
            params: { token },
            body: {},
          };
          const result = acceptInvitationSchema.safeParse(input);
          expect(result.success).toBe(true);
        });
      });
    });

    describe('token validation', () => {
      it('should reject empty token', () => {
        const input = {
          params: { token: '' },
          body: {},
        };
        const result = acceptInvitationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject missing token', () => {
        const input = {
          params: {},
          body: {},
        };
        const result = acceptInvitationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('email validation', () => {
      it('should accept valid email in body', () => {
        const input = {
          params: { token: 'valid-token' },
          body: { email: 'user@example.com' },
        };
        const result = acceptInvitationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should reject invalid email format', () => {
        const input = {
          params: { token: 'valid-token' },
          body: { email: 'not-an-email' },
        };
        const result = acceptInvitationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should allow missing email (undefined)', () => {
        const input = {
          params: { token: 'valid-token' },
          body: {},
        };
        const result = acceptInvitationSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.body.email).toBeUndefined();
        }
      });
    });

    describe('body validation', () => {
      it('should accept empty body object', () => {
        const input = {
          params: { token: 'valid-token' },
          body: {},
        };
        const result = acceptInvitationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Schema integration', () => {
    it('should work with typical invitation workflow', () => {
      // Create invitation
      const createInput = {
        body: {
          sessionId: validCuid,
          email: 'new.user@example.com',
          role: 'EDITOR',
        },
      };
      const createResult = createInvitationSchema.safeParse(createInput);
      expect(createResult.success).toBe(true);

      // List invitations
      const listInput = {
        params: { sessionId: validCuid },
      };
      const listResult = listInvitationsSchema.safeParse(listInput);
      expect(listResult.success).toBe(true);

      // Accept invitation
      const acceptInput = {
        params: { token: 'generated-token-123' },
        body: { email: 'new.user@example.com' },
      };
      const acceptResult = acceptInvitationSchema.safeParse(acceptInput);
      expect(acceptResult.success).toBe(true);
    });
  });
});
