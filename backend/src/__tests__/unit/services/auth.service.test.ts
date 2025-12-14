// Auth service unit tests
// Tests for authentication, registration, and password management

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserRole } from '@prisma/client';
import { AuthenticationError, ConflictError } from '../../../utils/errors';

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock email service
jest.mock('../../../services/email.service', () => ({
  __esModule: true,
  default: {
    sendPasswordReset: jest.fn().mockResolvedValue(true),
  },
}));

// Mock auth middleware with module factory
jest.mock('../../../middleware/auth', () => {
  const originalModule = jest.requireActual('../../../middleware/auth');
  return {
    ...originalModule,
    generateToken: jest.fn().mockReturnValue('mock-jwt-token'),
  };
});

// Get the mock prisma
import { mockPrisma } from '../../setup';

// Import after mocks are set up
import { AuthService } from '../../../services/auth.service';

// Helper to create mock user
const createMockUser = (
  overrides: Partial<{
    id: string;
    email: string;
    name: string;
    password: string | null;
    role: UserRole;
    ai_cost_limit: number;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
    deleted_by: string | null;
  }> = {}
) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  password: 'hashed_password',
  role: 'USER' as UserRole,
  ai_cost_limit: 10,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  deleted_by: null,
  ...overrides,
});

// Helper to create mock password reset record
const createMockPasswordReset = (
  overrides: Partial<{
    id: string;
    user_id: string;
    token: string;
    expires_at: Date;
    used_at: Date | null;
    created_at: Date;
    user: ReturnType<typeof createMockUser>;
  }> = {}
) => ({
  id: 'reset-123',
  user_id: 'user-123',
  token: 'hashed_token',
  expires_at: new Date(Date.now() + 3600000), // 1 hour from now
  used_at: null,
  created_at: new Date(),
  user: createMockUser(),
  ...overrides,
});

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register new user successfully', async () => {
      const mockUser = createMockUser({ email: 'new@example.com', name: 'New User' });

      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await authService.register({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe('new@example.com');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          password: 'hashed_password',
          name: 'New User',
          role: 'USER',
        },
        select: expect.any(Object),
      });
    });

    it('should lowercase email during registration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockPrisma.user.create.mockResolvedValue(createMockUser());
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.register({
        email: 'TEST@EXAMPLE.COM',
        password: 'password123',
        name: 'Test',
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
          }),
        })
      );
    });

    it('should throw ConflictError when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should allow registration if existing user is deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ deleted_at: new Date() }));
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockPrisma.user.create.mockResolvedValue(createMockUser({ id: 'new-user' }));
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test',
      });

      expect(result.user.id).toBe('new-user');
    });

    it('should create audit log on registration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockPrisma.user.create.mockResolvedValue(createMockUser());
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'user-123',
          action: 'CREATE',
          resource_type: 'user',
        }),
      });
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should lowercase email during login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.login({
        email: 'TEST@EXAMPLE.COM',
        password: 'password123',
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should throw AuthenticationError when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when user is deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ deleted_at: new Date() }));

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when user has no password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ password: null }));

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrong_password',
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('should create audit log on login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'LOGIN',
          resource_type: 'user',
        }),
      });
    });
  });

  describe('logout', () => {
    it('should blacklist token on logout', async () => {
      mockPrisma.tokenBlacklist.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.logout('jwt-token', 'user-123');

      expect(mockPrisma.tokenBlacklist.create).toHaveBeenCalledWith({
        data: {
          token: 'jwt-token',
          user_id: 'user-123',
          expires_at: expect.any(Date),
        },
      });
    });

    it('should create audit log on logout', async () => {
      mockPrisma.tokenBlacklist.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.logout('jwt-token', 'user-123');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'LOGOUT',
          resource_type: 'user',
        }),
      });
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      mockPrisma.user.update.mockResolvedValue(createMockUser());
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.changePassword('user-123', 'current_password', 'new_password');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { password: 'new_hashed_password' },
      });
    });

    it('should throw AuthenticationError when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.changePassword('user-123', 'current', 'new')
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when user is deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ deleted_at: new Date() }));

      await expect(
        authService.changePassword('user-123', 'current', 'new')
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when user has no password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ password: null }));

      await expect(
        authService.changePassword('user-123', 'current', 'new')
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when current password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.changePassword('user-123', 'wrong_current', 'new')
      ).rejects.toThrow(AuthenticationError);
    });

    it('should create audit log on password change', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      mockPrisma.user.update.mockResolvedValue(createMockUser());
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.changePassword('user-123', 'current', 'new');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'UPDATE',
          details: expect.stringContaining('password_changed'),
        }),
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = createMockUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser('user-123');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
        })
      );
    });

    it('should throw AuthenticationError when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.getCurrentUser('user-123')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when user is deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...createMockUser(),
        deleted_at: new Date(),
      });

      await expect(authService.getCurrentUser('user-123')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('requestPasswordReset', () => {
    it('should create password reset token', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.passwordReset.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      // Spy on crypto.randomBytes
      const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
      randomBytesSpy.mockReturnValue(Buffer.from('a'.repeat(32)) as any);

      await authService.requestPasswordReset('test@example.com');

      expect(mockPrisma.passwordReset.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-123',
          token: expect.any(String),
          expires_at: expect.any(Date),
        },
      });

      randomBytesSpy.mockRestore();
    });

    it('should lowercase email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      mockPrisma.passwordReset.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.requestPasswordReset('TEST@EXAMPLE.COM');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should silently return when user not found (security)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.requestPasswordReset('nonexistent@example.com')
      ).resolves.not.toThrow();

      expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled();
    });

    it('should silently return when user is deleted (security)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ deleted_at: new Date() }));

      await expect(
        authService.requestPasswordReset('test@example.com')
      ).resolves.not.toThrow();

      expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled();
    });

    it('should create audit log on password reset request', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
      mockPrisma.passwordReset.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.requestPasswordReset('test@example.com');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'REQUEST',
          resource_type: 'password_reset',
        }),
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const mockReset = createMockPasswordReset();
      mockPrisma.passwordReset.findFirst.mockResolvedValue(mockReset);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      mockPrisma.user.update.mockResolvedValue(createMockUser());
      mockPrisma.passwordReset.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.resetPassword('valid_token', 'new_password');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { password: 'new_hashed_password' },
      });
      expect(mockPrisma.passwordReset.update).toHaveBeenCalledWith({
        where: { id: 'reset-123' },
        data: { used_at: expect.any(Date) },
      });
    });

    it('should throw AuthenticationError when token is invalid', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(null);

      await expect(
        authService.resetPassword('invalid_token', 'new_password')
      ).rejects.toThrow(AuthenticationError);
    });

    it('should create audit log on password reset', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(createMockPasswordReset());
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      mockPrisma.user.update.mockResolvedValue(createMockUser());
      mockPrisma.passwordReset.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await authService.resetPassword('valid_token', 'new_password');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'UPDATE',
          resource_type: 'password_reset',
          details: expect.stringContaining('password_reset_completed'),
        }),
      });
    });
  });

  describe('verifyResetToken', () => {
    it('should return true for valid token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(createMockPasswordReset());

      const result = await authService.verifyResetToken('valid_token');

      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(null);

      const result = await authService.verifyResetToken('invalid_token');

      expect(result).toBe(false);
    });

    it('should query with hashed token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(null);

      await authService.verifyResetToken('test_token');

      expect(mockPrisma.passwordReset.findFirst).toHaveBeenCalledWith({
        where: {
          token: expect.any(String),
          expires_at: { gt: expect.any(Date) },
          used_at: null,
        },
      });
    });
  });
});
