// User service tests
// Tests for user profile management and user-related operations

import { mockPrisma } from '../setup';
import { UserService } from '../../services/user.service';
import { NotFoundError, AuthorizationError } from '../../utils/errors';

// Create fresh instance for testing
const userService = new UserService();

describe('UserService', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER' as const,
    ai_cost_limit: 10.0,
    password: 'hashed-password',
    deleted_at: null,
    deleted_by: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAdminUser = {
    ...mockUser,
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN' as const,
  };

  describe('getUserById', () => {
    it('should get user by id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await userService.getUserById('user-1', 'user-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
          role: true,
          ai_cost_limit: true,
          created_at: true,
          updated_at: true,
          deleted_at: true, // included for own profile
        }),
      });
      expect(result).toBeDefined();
    });

    it('should exclude deleted_at for other users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      await userService.getUserById('user-1', 'other-user');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
        }),
      });
    });

    it('should throw NotFoundError for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(userService.getUserById('non-existent')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError for deleted user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        deleted_at: new Date(),
      } as any);

      await expect(userService.getUserById('user-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateUser', () => {
    it('should update own profile', async () => {
      const updateData = { name: 'Updated Name' };
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        name: 'Updated Name',
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await userService.updateUser('user-1', 'user-1', updateData);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: updateData,
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
          role: true,
        }),
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      expect(result.name).toBe('Updated Name');
    });

    it('should allow admin to update other user profile', async () => {
      const updateData = { name: 'Admin Updated' };
      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser as any);
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        name: 'Admin Updated',
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await userService.updateUser('user-1', 'admin-1', updateData);

      expect(result.name).toBe('Admin Updated');
    });

    it('should throw AuthorizationError when non-admin updates other user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(
        userService.updateUser('user-2', 'user-1', { name: 'Hacked' }),
      ).rejects.toThrow(AuthorizationError);
    });

    it('should update ai_cost_limit', async () => {
      const updateData = { ai_cost_limit: 20.0 };
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        ai_cost_limit: 20.0,
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await userService.updateUser('user-1', 'user-1', updateData);

      expect(result.ai_cost_limit).toBe(20.0);
    });
  });

  describe('deleteUser', () => {
    it('should soft delete own account', async () => {
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await userService.deleteUser('user-1', 'user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          deleted_at: expect.any(Date),
          deleted_by: 'user-1',
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should allow admin to delete other user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser as any);
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await userService.deleteUser('user-1', 'admin-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          deleted_by: 'admin-1',
        }),
      });
    });

    it('should throw AuthorizationError when non-admin deletes other user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(userService.deleteUser('user-2', 'user-1')).rejects.toThrow(
        AuthorizationError,
      );
    });
  });

  describe('getUserSessions', () => {
    it('should get user sessions with pagination', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          name: 'Test Session',
          owner: { id: 'user-1', name: 'Test', email: 'test@example.com' },
          participants: [],
        },
      ];

      mockPrisma.session.findMany.mockResolvedValue(mockSessions as any);
      mockPrisma.session.count.mockResolvedValue(1);

      const result = await userService.getUserSessions('user-1', 10, 0);

      expect(result.sessions).toEqual(mockSessions);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('should use default pagination values', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      const result = await userService.getUserSessions('user-1');

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  describe('getAIUsageStats', () => {
    it('should get AI usage statistics', async () => {
      const mockUsage = [
        {
          id: 'usage-1',
          user_id: 'user-1',
          model: 'gpt-4',
          tokens_used: 1000,
          cost_usd: 0.5,
          request_type: 'chat',
          prompt_length: 500,
          response_length: 500,
          created_at: new Date(),
        },
        {
          id: 'usage-2',
          user_id: 'user-1',
          model: 'gpt-4',
          tokens_used: 500,
          cost_usd: 0.25,
          request_type: 'chat',
          prompt_length: 250,
          response_length: 250,
          created_at: new Date(),
        },
      ];

      mockPrisma.aIUsage.findMany.mockResolvedValue(mockUsage);

      const result = await userService.getAIUsageStats('user-1', 30);

      expect(result.totalTokens).toBe(1500);
      expect(result.totalCost).toBe(0.75);
      expect(result.totalRequests).toBe(2);
      expect(result.byModel['gpt-4'].tokens).toBe(1500);
    });

    it('should use default days value', async () => {
      mockPrisma.aIUsage.findMany.mockResolvedValue([]);

      const result = await userService.getAIUsageStats('user-1');

      expect(result.totalTokens).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('should group usage by model', async () => {
      const mockUsage = [
        {
          id: 'usage-1',
          model: 'gpt-4',
          tokens_used: 1000,
          cost_usd: 0.5,
        },
        {
          id: 'usage-2',
          model: 'gpt-3.5-turbo',
          tokens_used: 2000,
          cost_usd: 0.1,
        },
      ];

      mockPrisma.aIUsage.findMany.mockResolvedValue(mockUsage as any);

      const result = await userService.getAIUsageStats('user-1');

      expect(result.byModel['gpt-4'].tokens).toBe(1000);
      expect(result.byModel['gpt-3.5-turbo'].tokens).toBe(2000);
    });
  });

  describe('getAuditLog', () => {
    it('should get user audit log with pagination', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'user-1',
          action: 'CREATE',
          resource_type: 'session',
          resource_id: 'session-1',
          created_at: new Date(),
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs as any);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await userService.getAuditLog('user-1', 50, 0);

      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
    });

    it('should use default pagination values', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const result = await userService.getAuditLog('user-1');

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });
  });

  describe('listUsers', () => {
    it('should list all users for admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser as any);
      mockPrisma.user.findMany.mockResolvedValue([mockUser] as any);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await userService.listUsers('admin-1', {});

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser as any);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await userService.listUsers('admin-1', { role: 'ADMIN' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'ADMIN',
          }),
        }),
      );
    });

    it('should throw AuthorizationError for non-admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(userService.listUsers('user-1', {})).rejects.toThrow(AuthorizationError);
    });

    it('should use pagination parameters', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser as any);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await userService.listUsers('admin-1', { limit: 10, offset: 5 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        }),
      );
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(5);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role for admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser as any);
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        role: 'MODERATOR',
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await userService.updateUserRole('user-1', 'MODERATOR', 'admin-1');

      expect(result.role).toBe('MODERATOR');
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'UPDATE',
          resource_type: 'user',
          details: expect.stringContaining('MODERATOR'),
        }),
      });
    });

    it('should throw AuthorizationError for non-admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(userService.updateUserRole('user-2', 'ADMIN', 'user-1')).rejects.toThrow(
        AuthorizationError,
      );
    });

    it('should allow promoting to ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser as any);
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        role: 'ADMIN',
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await userService.updateUserRole('user-1', 'ADMIN', 'admin-1');

      expect(result.role).toBe('ADMIN');
    });
  });
});
