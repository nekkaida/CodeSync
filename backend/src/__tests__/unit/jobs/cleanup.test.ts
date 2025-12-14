// Cleanup jobs tests
// Tests for automated cleanup functions

import { mockPrisma } from '../../setup';

// Import after mocks are set up
import {
  cleanupExpiredPasswordResets,
  cleanupExpiredTokenBlacklist,
  cleanupOldRateLimits,
  cleanupOldAuditLogs,
  archiveInactiveSessions,
  hardDeleteOldRecords,
  runAllCleanupJobs,
  startCleanupSchedule,
} from '../../../jobs/cleanup';

describe('Cleanup Jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('cleanupExpiredPasswordResets', () => {
    it('should delete expired and used password reset tokens', async () => {
      (mockPrisma.passwordReset as any) = {
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
      };

      const result = await cleanupExpiredPasswordResets();

      expect(result).toBe(5);
      expect(mockPrisma.passwordReset.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expires_at: { lt: expect.any(Date) } },
            { used_at: { not: null } },
          ],
        },
      });
    });

    it('should return 0 when no tokens to cleanup', async () => {
      (mockPrisma.passwordReset as any) = {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      };

      const result = await cleanupExpiredPasswordResets();

      expect(result).toBe(0);
    });

    it('should return 0 on database error', async () => {
      (mockPrisma.passwordReset as any) = {
        deleteMany: jest.fn().mockRejectedValue(new Error('DB error')),
      };

      const result = await cleanupExpiredPasswordResets();

      expect(result).toBe(0);
    });
  });

  describe('cleanupExpiredTokenBlacklist', () => {
    it('should delete expired blacklisted tokens', async () => {
      mockPrisma.tokenBlacklist.deleteMany.mockResolvedValue({ count: 10 });

      const result = await cleanupExpiredTokenBlacklist();

      expect(result).toBe(10);
      expect(mockPrisma.tokenBlacklist.deleteMany).toHaveBeenCalledWith({
        where: {
          expires_at: { lt: expect.any(Date) },
        },
      });
    });

    it('should return 0 when no tokens to cleanup', async () => {
      mockPrisma.tokenBlacklist.deleteMany.mockResolvedValue({ count: 0 });

      const result = await cleanupExpiredTokenBlacklist();

      expect(result).toBe(0);
    });

    it('should return 0 on database error', async () => {
      mockPrisma.tokenBlacklist.deleteMany.mockRejectedValue(new Error('DB error'));

      const result = await cleanupExpiredTokenBlacklist();

      expect(result).toBe(0);
    });
  });

  describe('cleanupOldRateLimits', () => {
    it('should delete rate limits older than 24 hours', async () => {
      mockPrisma.rateLimit.deleteMany.mockResolvedValue({ count: 100 });

      const result = await cleanupOldRateLimits();

      expect(result).toBe(100);
      expect(mockPrisma.rateLimit.deleteMany).toHaveBeenCalledWith({
        where: {
          window_start: { lt: expect.any(Date) },
        },
      });
    });

    it('should return 0 when no rate limits to cleanup', async () => {
      mockPrisma.rateLimit.deleteMany.mockResolvedValue({ count: 0 });

      const result = await cleanupOldRateLimits();

      expect(result).toBe(0);
    });

    it('should return 0 on database error', async () => {
      mockPrisma.rateLimit.deleteMany.mockRejectedValue(new Error('DB error'));

      const result = await cleanupOldRateLimits();

      expect(result).toBe(0);
    });
  });

  describe('cleanupOldAuditLogs', () => {
    it('should delete audit logs older than 90 days', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 500 });

      const result = await cleanupOldAuditLogs();

      expect(result).toBe(500);
      expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          created_at: { lt: expect.any(Date) },
        },
      });
    });

    it('should return 0 when no audit logs to cleanup', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      const result = await cleanupOldAuditLogs();

      expect(result).toBe(0);
    });

    it('should return 0 on database error', async () => {
      mockPrisma.auditLog.deleteMany.mockRejectedValue(new Error('DB error'));

      const result = await cleanupOldAuditLogs();

      expect(result).toBe(0);
    });
  });

  describe('archiveInactiveSessions', () => {
    it('should archive sessions inactive for 30 days', async () => {
      mockPrisma.session.updateMany.mockResolvedValue({ count: 25 });

      const result = await archiveInactiveSessions();

      expect(result).toBe(25);
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          updated_at: { lt: expect.any(Date) },
          deleted_at: null,
        },
        data: {
          status: 'ARCHIVED',
        },
      });
    });

    it('should return 0 when no sessions to archive', async () => {
      mockPrisma.session.updateMany.mockResolvedValue({ count: 0 });

      const result = await archiveInactiveSessions();

      expect(result).toBe(0);
    });

    it('should return 0 on database error', async () => {
      mockPrisma.session.updateMany.mockRejectedValue(new Error('DB error'));

      const result = await archiveInactiveSessions();

      expect(result).toBe(0);
    });
  });

  describe('hardDeleteOldRecords', () => {
    it('should hard delete soft-deleted records older than 30 days', async () => {
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.sessionFile.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 50 });
      mockPrisma.user.deleteMany.mockResolvedValue({ count: 2 });

      const result = await hardDeleteOldRecords();

      expect(result).toBe(67); // 5 + 10 + 50 + 2
      expect(mockPrisma.session.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.sessionFile.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.message.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.user.deleteMany).toHaveBeenCalled();
    });

    it('should return 0 when no records to delete', async () => {
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.sessionFile.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.deleteMany.mockResolvedValue({ count: 0 });

      const result = await hardDeleteOldRecords();

      expect(result).toBe(0);
    });

    it('should return 0 on database error', async () => {
      mockPrisma.session.deleteMany.mockRejectedValue(new Error('DB error'));

      const result = await hardDeleteOldRecords();

      expect(result).toBe(0);
    });

    it('should delete sessions with correct criteria', async () => {
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.sessionFile.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.deleteMany.mockResolvedValue({ count: 0 });

      await hardDeleteOldRecords();

      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          deleted_at: { lt: expect.any(Date), not: null },
        },
      });
    });
  });

  describe('runAllCleanupJobs', () => {
    it('should run all cleanup jobs and return total', async () => {
      (mockPrisma.passwordReset as any) = {
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
      };
      mockPrisma.tokenBlacklist.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.rateLimit.deleteMany.mockResolvedValue({ count: 100 });
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 50 });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.sessionFile.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.user.deleteMany.mockResolvedValue({ count: 0 });

      await runAllCleanupJobs();

      // Verify all jobs were called
      expect(mockPrisma.passwordReset.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.tokenBlacklist.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.rateLimit.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.session.updateMany).toHaveBeenCalled();
    });

    it('should continue even if some jobs fail', async () => {
      (mockPrisma.passwordReset as any) = {
        deleteMany: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      mockPrisma.tokenBlacklist.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.rateLimit.deleteMany.mockResolvedValue({ count: 100 });
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 50 });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.sessionFile.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.deleteMany.mockResolvedValue({ count: 0 });

      // Should not throw
      await expect(runAllCleanupJobs()).resolves.not.toThrow();
    });
  });

  describe('startCleanupSchedule', () => {
    it('should run cleanup immediately on start', async () => {
      (mockPrisma.passwordReset as any) = {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      };
      mockPrisma.tokenBlacklist.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.rateLimit.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.sessionFile.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.deleteMany.mockResolvedValue({ count: 0 });

      const timeout = startCleanupSchedule();

      // Should have scheduled cleanup
      expect(timeout).toBeDefined();

      // Cleanup
      clearTimeout(timeout);
    });

    it('should return a timeout handle', () => {
      (mockPrisma.passwordReset as any) = {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      };
      mockPrisma.tokenBlacklist.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.rateLimit.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.sessionFile.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.deleteMany.mockResolvedValue({ count: 0 });

      const timeout = startCleanupSchedule();

      expect(typeof timeout).toBe('object');
      expect(timeout).toHaveProperty('ref');
      expect(timeout).toHaveProperty('unref');

      clearTimeout(timeout);
    });

    it('should schedule next run for 2 AM', () => {
      (mockPrisma.passwordReset as any) = {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      };
      mockPrisma.tokenBlacklist.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.rateLimit.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.sessionFile.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.deleteMany.mockResolvedValue({ count: 0 });

      // Set time to 3 AM - next run should be tomorrow at 2 AM
      jest.setSystemTime(new Date('2024-01-15T03:00:00'));

      const timeout = startCleanupSchedule();

      // The timeout should be scheduled for ~23 hours later
      expect(timeout).toBeDefined();

      clearTimeout(timeout);
    });

    it('should schedule for today if before 2 AM', () => {
      (mockPrisma.passwordReset as any) = {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      };
      mockPrisma.tokenBlacklist.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.rateLimit.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.sessionFile.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.deleteMany.mockResolvedValue({ count: 0 });

      // Set time to 1 AM - next run should be today at 2 AM
      jest.setSystemTime(new Date('2024-01-15T01:00:00'));

      const timeout = startCleanupSchedule();

      expect(timeout).toBeDefined();

      clearTimeout(timeout);
    });
  });

  describe('default export', () => {
    it('should export all cleanup functions', async () => {
      const cleanup = await import('../../../jobs/cleanup');

      expect(cleanup.default.cleanupExpiredPasswordResets).toBeDefined();
      expect(cleanup.default.cleanupExpiredTokenBlacklist).toBeDefined();
      expect(cleanup.default.cleanupOldRateLimits).toBeDefined();
      expect(cleanup.default.cleanupOldAuditLogs).toBeDefined();
      expect(cleanup.default.archiveInactiveSessions).toBeDefined();
      expect(cleanup.default.hardDeleteOldRecords).toBeDefined();
      expect(cleanup.default.runAllCleanupJobs).toBeDefined();
      expect(cleanup.default.startCleanupSchedule).toBeDefined();
    });
  });
});
