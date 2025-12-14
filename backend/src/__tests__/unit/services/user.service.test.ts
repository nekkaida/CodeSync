// User service tests
// Tests for user profile management and operations

import { UserRole } from '@prisma/client';
import { mockPrisma } from '../../setup';
import { NotFoundError, AuthorizationError } from '../../../utils/errors';
import userService, { UserService } from '../../../services/user.service';

// Helper to create mock user
const createMockUser = (overrides: Partial<{
  id: string;
  email: string;
  name: string;
  role: UserRole;
  ai_cost_limit: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  deleted_by: string | null;
  password: string | null;
}> = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER' as UserRole as UserRole,
  ai_cost_limit: 10,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  deleted_by: null,
  password: 'hashed_password',
  ...overrides,
});

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
    jest.clearAllMocks();
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserById('user-123');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
          role: true,
        }),
      });
    });

    it('should throw NotFoundError when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('non-existent')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when user is soft-deleted', async () => {
      const mockUser = createMockUser({ deleted_at: new Date() });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.getUserById('user-123')).rejects.toThrow(NotFoundError);
    });

    it('should include deleted_at when requesting own profile', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await service.getUserById('user-123', 'user-123');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: expect.objectContaining({
          deleted_at: true,
        }),
      });
    });
  });

  describe('updateUser', () => {
    it('should update own profile successfully', async () => {
      const mockUser = createMockUser({ name: 'Updated Name' });
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.updateUser('user-123', 'user-123', { name: 'Updated Name' });

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { name: 'Updated Name' },
        select: expect.any(Object),
      });
    });

    it('should allow admin to update other user profile', async () => {
      const adminUser = createMockUser({ id: 'admin-1', role: 'ADMIN' as UserRole as UserRole });
      const targetUser = createMockUser({ id: 'user-456', name: 'Updated' });

      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      mockPrisma.user.update.mockResolvedValue(targetUser);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.updateUser('user-456', 'admin-1', { name: 'Updated' });

      expect(result).toEqual(targetUser);
    });

    it('should throw AuthorizationError when non-admin tries to update another user', async () => {
      const regularUser = createMockUser({ id: 'user-123', role: 'USER' as UserRole });
      mockPrisma.user.findUnique.mockResolvedValue(regularUser);

      await expect(
        service.updateUser('user-456', 'user-123', { name: 'Hacked' }),
      ).rejects.toThrow(AuthorizationError);
    });

    it('should create audit log entry', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.updateUser('user-123', 'user-123', { name: 'New Name' });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-123',
          action: 'UPDATE',
          resource_type: 'user',
          resource_id: 'user-123',
          details: JSON.stringify({ name: 'New Name' }),
        },
      });
    });

    it('should update ai_cost_limit', async () => {
      const mockUser = createMockUser({ ai_cost_limit: 50 });
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.updateUser('user-123', 'user-123', { ai_cost_limit: 50 });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { ai_cost_limit: 50 },
        select: expect.any(Object),
      });
    });
  });

  describe('deleteUser', () => {
    it('should soft delete own account', async () => {
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.deleteUser('user-123', 'user-123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          deleted_at: expect.any(Date),
          deleted_by: 'user-123',
        },
      });
    });

    it('should allow admin to delete other user', async () => {
      const adminUser = createMockUser({ id: 'admin-1', role: 'ADMIN' as UserRole });
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.deleteUser('user-456', 'admin-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-456' },
        data: expect.objectContaining({
          deleted_by: 'admin-1',
        }),
      });
    });

    it('should throw AuthorizationError when non-admin tries to delete another user', async () => {
      const regularUser = createMockUser({ id: 'user-123', role: 'USER' as UserRole });
      mockPrisma.user.findUnique.mockResolvedValue(regularUser);

      await expect(service.deleteUser('user-456', 'user-123')).rejects.toThrow(AuthorizationError);
    });

    it('should create audit log entry', async () => {
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.deleteUser('user-123', 'user-123');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-123',
          action: 'DELETE',
          resource_type: 'user',
          resource_id: 'user-123',
          details: JSON.stringify({ deleted_by: 'user-123' }),
        },
      });
    });
  });

  describe('getUserSessions', () => {
    it('should return user sessions with pagination', async () => {
      const mockSessions = [
        { id: 'session-1', name: 'Session 1', owner: { id: 'user-123' }, participants: [] },
        { id: 'session-2', name: 'Session 2', owner: { id: 'user-456' }, participants: [] },
      ];

      mockPrisma.session.findMany.mockResolvedValue(mockSessions as any);
      mockPrisma.session.count.mockResolvedValue(2);

      const result = await service.getUserSessions('user-123', 20, 0);

      expect(result).toEqual({
        sessions: mockSessions,
        total: 2,
        limit: 20,
        offset: 0,
      });
    });

    it('should use default pagination values', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      const result = await service.getUserSessions('user-123');

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should filter by owner and participant', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      await service.getUserSessions('user-123');

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { owner_id: 'user-123' },
              { participants: { some: { user_id: 'user-123', left_at: null } } },
            ],
            deleted_at: null,
          },
        }),
      );
    });
  });

  describe('getAIUsageStats', () => {
    it('should return AI usage statistics', async () => {
      const mockUsage = [
        { id: 'usage-1', model: 'gpt-4', tokens_used: 1000, cost_usd: 0.03, created_at: new Date() },
        { id: 'usage-2', model: 'gpt-4', tokens_used: 500, cost_usd: 0.015, created_at: new Date() },
        { id: 'usage-3', model: 'gpt-3.5', tokens_used: 2000, cost_usd: 0.002, created_at: new Date() },
      ];

      mockPrisma.aIUsage.findMany.mockResolvedValue(mockUsage as any);

      const result = await service.getAIUsageStats('user-123', 30);

      expect(result.totalTokens).toBe(3500);
      expect(result.totalCost).toBe(0.047);
      expect(result.totalRequests).toBe(3);
      expect(result.byModel['gpt-4']).toEqual({
        tokens: 1500,
        cost: 0.045,
        requests: 2,
      });
      expect(result.byModel['gpt-3.5']).toEqual({
        tokens: 2000,
        cost: 0.002,
        requests: 1,
      });
    });

    it('should use default 30 days', async () => {
      mockPrisma.aIUsage.findMany.mockResolvedValue([]);

      await service.getAIUsageStats('user-123');

      expect(mockPrisma.aIUsage.findMany).toHaveBeenCalledWith({
        where: {
          user_id: 'user-123',
          created_at: { gte: expect.any(Date) },
        },
        orderBy: { created_at: 'desc' },
      });
    });

    it('should return last 20 usage records', async () => {
      const mockUsage = Array.from({ length: 25 }, (_, i) => ({
        id: `usage-${i}`,
        model: 'gpt-4',
        tokens_used: 100,
        cost_usd: 0.003,
        created_at: new Date(),
      }));

      mockPrisma.aIUsage.findMany.mockResolvedValue(mockUsage as any);

      const result = await service.getAIUsageStats('user-123');

      expect(result.usage.length).toBe(20);
    });

    it('should return empty stats when no usage', async () => {
      mockPrisma.aIUsage.findMany.mockResolvedValue([]);

      const result = await service.getAIUsageStats('user-123');

      expect(result.totalTokens).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.totalRequests).toBe(0);
      expect(result.byModel).toEqual({});
    });
  });

  describe('getAuditLog', () => {
    it('should return audit logs with pagination', async () => {
      const mockLogs = [
        { id: 'log-1', action: 'CREATE', resource_type: 'session' },
        { id: 'log-2', action: 'UPDATE', resource_type: 'user' },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs as any);
      mockPrisma.auditLog.count.mockResolvedValue(2);

      const result = await service.getAuditLog('user-123', 50, 0);

      expect(result).toEqual({
        logs: mockLogs,
        total: 2,
        limit: 50,
        offset: 0,
      });
    });

    it('should use default pagination values', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const result = await service.getAuditLog('user-123');

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });
  });

  describe('listUsers', () => {
    it('should return list of users for admin', async () => {
      const adminUser = createMockUser({ id: 'admin-1', role: 'ADMIN' as UserRole });
      const mockUsers = [
        createMockUser({ id: 'user-1' }),
        createMockUser({ id: 'user-2' }),
      ];

      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      mockPrisma.user.findMany.mockResolvedValue(mockUsers as any);
      mockPrisma.user.count.mockResolvedValue(2);

      const result = await service.listUsers('admin-1', {});

      expect(result.users).toEqual(mockUsers);
      expect(result.total).toBe(2);
    });

    it('should throw AuthorizationError for non-admin', async () => {
      const regularUser = createMockUser({ id: 'user-123', role: 'USER' as UserRole });
      mockPrisma.user.findUnique.mockResolvedValue(regularUser);

      await expect(service.listUsers('user-123', {})).rejects.toThrow(AuthorizationError);
    });

    it('should filter by role', async () => {
      const adminUser = createMockUser({ id: 'admin-1', role: 'ADMIN' as UserRole });
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.listUsers('admin-1', { role: 'MODERATOR' as UserRole });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deleted_at: null, role: 'MODERATOR' as UserRole },
        }),
      );
    });

    it('should apply pagination', async () => {
      const adminUser = createMockUser({ id: 'admin-1', role: 'ADMIN' as UserRole });
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.listUsers('admin-1', { limit: 10, offset: 5 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        }),
      );
    });

    it('should use default pagination values', async () => {
      const adminUser = createMockUser({ id: 'admin-1', role: 'ADMIN' as UserRole });
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.listUsers('admin-1', {});

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role as admin', async () => {
      const adminUser = createMockUser({ id: 'admin-1', role: 'ADMIN' as UserRole });
      const updatedUser = createMockUser({ id: 'user-456', role: 'MODERATOR' as UserRole });

      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      mockPrisma.user.update.mockResolvedValue(updatedUser);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.updateUserRole('user-456', 'MODERATOR', 'admin-1');

      expect(result.role).toBe('MODERATOR');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-456' },
        data: { role: 'MODERATOR' as UserRole },
        select: expect.any(Object),
      });
    });

    it('should throw AuthorizationError for non-admin', async () => {
      const regularUser = createMockUser({ id: 'user-123', role: 'USER' as UserRole });
      mockPrisma.user.findUnique.mockResolvedValue(regularUser);

      await expect(
        service.updateUserRole('user-456', 'ADMIN', 'user-123'),
      ).rejects.toThrow(AuthorizationError);
    });

    it('should create audit log entry', async () => {
      const adminUser = createMockUser({ id: 'admin-1', role: 'ADMIN' as UserRole });
      const updatedUser = createMockUser({ id: 'user-456', role: 'ADMIN' as UserRole });

      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      mockPrisma.user.update.mockResolvedValue(updatedUser);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.updateUserRole('user-456', 'ADMIN', 'admin-1');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          user_id: 'admin-1',
          action: 'UPDATE',
          resource_type: 'user',
          resource_id: 'user-456',
          details: JSON.stringify({ role_changed_to: 'ADMIN' }),
        },
      });
    });
  });

  describe('default export', () => {
    it('should export a UserService instance', () => {
      expect(userService).toBeInstanceOf(UserService);
    });
  });
});
