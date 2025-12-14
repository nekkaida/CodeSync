// Auth service unit tests
// Tests authentication logic

import { mockDeep, mockReset } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const mockPrisma = mockDeep<PrismaClient>();

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

// Mock email service
jest.mock('../../services/email.service', () => ({
  __esModule: true,
  default: {
    sendPasswordReset: jest.fn().mockResolvedValue(true),
    sendEmail: jest.fn().mockResolvedValue(true),
  },
}));

// Mock auth middleware
jest.mock('../../middleware/auth', () => ({
  generateToken: jest.fn().mockReturnValue('mock-jwt-token'),
}));

// Import after mocking
import { AuthService } from '../../services/auth.service';

describe('AuthService', () => {
  let authService: AuthService;

  const USER_ID = 'cluser00000000000001';

  const mockUser = {
    id: USER_ID,
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    password: '',
    deleted_at: null,
    deleted_by: null,
    created_at: new Date(),
    updated_at: new Date(),
    ai_cost_limit: 10.0,
  };

  beforeEach(async () => {
    mockReset(mockPrisma);
    authService = new AuthService();
    // Hash a real password for testing
    mockUser.password = await bcrypt.hash('Password123', 12);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: USER_ID,
        email: 'newuser@example.com',
        name: 'New User',
        role: 'USER',
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'Password123',
        name: 'New User',
      });

      expect(result.user.email).toBe('newuser@example.com');
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.register({
        email: 'TEST@EXAMPLE.COM',
        password: 'Password123',
        name: 'Test User',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
          }),
        }),
      );
    });

    it('should throw ConflictError if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
        }),
      ).rejects.toThrow('Email already registered');
    });

    it('should allow registration if previous user was deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        deleted_at: new Date(),
      } as any);
      mockPrisma.user.create.mockResolvedValue({
        id: USER_ID,
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
      });

      expect(result.user).toBeDefined();
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw AuthenticationError for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw AuthenticationError for deleted user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        deleted_at: new Date(),
      } as any);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw AuthenticationError for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw AuthenticationError if user has no password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: null,
      } as any);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should normalize email to lowercase during login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.login({
        email: 'TEST@EXAMPLE.COM',
        password: 'Password123',
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('logout', () => {
    it('should blacklist token and log audit', async () => {
      mockPrisma.tokenBlacklist.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.logout('valid-token', USER_ID);

      expect(mockPrisma.tokenBlacklist.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LOGOUT',
          }),
        }),
      );
    });
  });

  describe('changePassword', () => {
    it('should change password with valid current password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.changePassword(USER_ID, 'Password123', 'NewPassword456');

      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw AuthenticationError if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.changePassword(USER_ID, 'Password123', 'NewPassword456'),
      ).rejects.toThrow('User not found');
    });

    it('should throw AuthenticationError for deleted user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        deleted_at: new Date(),
      } as any);

      await expect(
        authService.changePassword(USER_ID, 'Password123', 'NewPassword456'),
      ).rejects.toThrow('User not found');
    });

    it('should throw AuthenticationError if current password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(
        authService.changePassword(USER_ID, 'WrongPassword', 'NewPassword456'),
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw AuthenticationError if user has no password set', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: null,
      } as any);

      await expect(
        authService.changePassword(USER_ID, 'Password123', 'NewPassword456'),
      ).rejects.toThrow('User password not set');
    });
  });

  describe('getCurrentUser', () => {
    it('should return user data', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await authService.getCurrentUser(USER_ID);

      expect(result.email).toBe('test@example.com');
    });

    it('should throw AuthenticationError if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.getCurrentUser(USER_ID)).rejects.toThrow('User not found');
    });

    it('should throw AuthenticationError for deleted user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        deleted_at: new Date(),
      } as any);

      await expect(authService.getCurrentUser(USER_ID)).rejects.toThrow('User not found');
    });
  });

  describe('requestPasswordReset', () => {
    it('should not throw for non-existent user (security)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.requestPasswordReset('nonexistent@example.com')).resolves.not.toThrow();
      expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled();
    });

    it('should not throw for deleted user (security)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        deleted_at: new Date(),
      } as any);

      await expect(authService.requestPasswordReset('test@example.com')).resolves.not.toThrow();
      expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled();
    });

    it('should create reset token and send email for existing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.passwordReset.create.mockResolvedValue({
        id: 'clreset0000000000001',
        user_id: USER_ID,
        token: 'hashed-token',
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await expect(authService.requestPasswordReset('test@example.com')).resolves.not.toThrow();

      expect(mockPrisma.passwordReset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: USER_ID,
            token: expect.any(String),
            expires_at: expect.any(Date),
          }),
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: USER_ID,
            action: 'REQUEST',
            resource_type: 'password_reset',
          }),
        }),
      );
    });
  });

  describe('resetPassword', () => {
    const mockResetRecord = {
      id: 'clreset0000000000001',
      user_id: USER_ID,
      token: 'hashed-token',
      expires_at: new Date(Date.now() + 3600000),
      used_at: null,
      user: mockUser,
    };

    it('should reset password with valid token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(mockResetRecord as any);
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.passwordReset.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.resetPassword('valid-reset-token', 'NewPassword456');

      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockPrisma.passwordReset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            used_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw AuthenticationError for invalid token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(null);

      await expect(authService.resetPassword('invalid-token', 'NewPassword456')).rejects.toThrow(
        'Invalid or expired reset token',
      );
    });
  });

  describe('verifyResetToken', () => {
    it('should return true for valid token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue({
        id: 'clreset0000000000001',
        token: 'hashed-token',
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
      } as any);

      const result = await authService.verifyResetToken('valid-token');

      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(null);

      const result = await authService.verifyResetToken('invalid-token');

      expect(result).toBe(false);
    });
  });
});
