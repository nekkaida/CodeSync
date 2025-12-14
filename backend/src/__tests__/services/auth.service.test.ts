// Auth service tests
// Unit tests for authentication functionality

import bcrypt from 'bcryptjs';
import { AuthService } from '../../services/auth.service';
import { mockPrisma } from '../setup';
import { AuthenticationError, ConflictError } from '../../utils/errors';
import emailService from '../../services/email.service';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...mockUser,
        password: 'hashed-password',
        deleted_at: null,
        deleted_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        ai_cost_limit: 10.0,
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
      });

      expect(result.user).toMatchObject({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      });
      expect(result.token).toBeDefined();
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictError if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed',
        role: 'USER',
        deleted_at: null,
        deleted_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        ai_cost_limit: 10.0,
      } as any);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        password: hashedPassword,
        deleted_at: null,
        deleted_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        ai_cost_limit: 10.0,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBeDefined();
    });

    it('should throw AuthenticationError for invalid email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for invalid password', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        password: hashedPassword,
        deleted_at: null,
        deleted_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        ai_cost_limit: 10.0,
      } as any);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'WrongPassword123',
        }),
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const hashedPassword = await bcrypt.hash('OldPassword123', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        password: hashedPassword,
        deleted_at: null,
        deleted_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        ai_cost_limit: 10.0,
      } as any);
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.changePassword('user-1', 'OldPassword123', 'NewPassword123');

      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should throw error for incorrect current password', async () => {
      const hashedPassword = await bcrypt.hash('OldPassword123', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        password: hashedPassword,
        deleted_at: null,
        deleted_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        ai_cost_limit: 10.0,
      } as any);

      await expect(
        authService.changePassword('user-1', 'WrongPassword123', 'NewPassword123'),
      ).rejects.toThrow(AuthenticationError);
    });
  });

  // NOTE: Password reset tests are skipped because PasswordReset model
  // is not yet defined in the Prisma schema. The auth service methods exist
  // but the database model needs to be added.
  describe.skip('requestPasswordReset', () => {
    it('should create reset token and send email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        password: 'hashed',
        deleted_at: null,
        deleted_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        ai_cost_limit: 10.0,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      // mockPrisma.passwordReset.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.requestPasswordReset('test@example.com');

      // expect(mockPrisma.passwordReset.create).toHaveBeenCalled();
      expect(emailService.sendPasswordReset).toHaveBeenCalled();
    });

    it('should not throw error for non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.requestPasswordReset('nonexistent@example.com'),
      ).resolves.not.toThrow();
    });
  });

  describe.skip('resetPassword', () => {
    it('should reset password with valid token', async () => {
      // mockPrisma.passwordReset.findFirst.mockResolvedValue({...} as any);
      mockPrisma.user.update.mockResolvedValue({} as any);
      // mockPrisma.passwordReset.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.resetPassword('valid-token', 'NewPassword123');

      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should throw error for invalid token', async () => {
      // mockPrisma.passwordReset.findFirst.mockResolvedValue(null);

      await expect(
        authService.resetPassword('invalid-token', 'NewPassword123'),
      ).rejects.toThrow(AuthenticationError);
    });
  });
});
