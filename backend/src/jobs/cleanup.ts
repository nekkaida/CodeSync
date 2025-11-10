// Automated cleanup jobs
// Periodic cleanup of old data and expired sessions

import { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';

const prisma = new PrismaClient();

// Cleanup expired password reset tokens
export async function cleanupExpiredPasswordResets(): Promise<number> {
  try {
    const result = await prisma.passwordReset.deleteMany({
      where: {
        OR: [
          { expires_at: { lt: new Date() } },
          { used_at: { not: null } },
        ],
      },
    });

    if (result.count > 0) {
      log.info(`Cleaned up ${result.count} expired password reset tokens`);
    }

    return result.count;
  } catch (error) {
    log.error('Failed to cleanup expired password resets', error);
    return 0;
  }
}

// Cleanup old blacklisted tokens
export async function cleanupExpiredTokenBlacklist(): Promise<number> {
  try {
    const result = await prisma.tokenBlacklist.deleteMany({
      where: {
        expires_at: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      log.info(`Cleaned up ${result.count} expired blacklisted tokens`);
    }

    return result.count;
  } catch (error) {
    log.error('Failed to cleanup expired token blacklist', error);
    return 0;
  }
}

// Cleanup old rate limit records (older than 24 hours)
export async function cleanupOldRateLimits(): Promise<number> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.rateLimit.deleteMany({
      where: {
        window_start: { lt: oneDayAgo },
      },
    });

    if (result.count > 0) {
      log.info(`Cleaned up ${result.count} old rate limit records`);
    }

    return result.count;
  } catch (error) {
    log.error('Failed to cleanup old rate limits', error);
    return 0;
  }
}

// Cleanup old audit logs (older than 90 days)
export async function cleanupOldAuditLogs(): Promise<number> {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const result = await prisma.auditLog.deleteMany({
      where: {
        created_at: { lt: ninetyDaysAgo },
      },
    });

    if (result.count > 0) {
      log.info(`Cleaned up ${result.count} old audit log entries`);
    }

    return result.count;
  } catch (error) {
    log.error('Failed to cleanup old audit logs', error);
    return 0;
  }
}

// Archive inactive sessions (no activity for 30 days)
export async function archiveInactiveSessions(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await prisma.session.updateMany({
      where: {
        status: 'ACTIVE',
        updated_at: { lt: thirtyDaysAgo },
        deleted_at: null,
      },
      data: {
        status: 'ARCHIVED',
      },
    });

    if (result.count > 0) {
      log.info(`Archived ${result.count} inactive sessions`);
    }

    return result.count;
  } catch (error) {
    log.error('Failed to archive inactive sessions', error);
    return 0;
  }
}

// Delete soft-deleted records (deleted more than 30 days ago)
export async function hardDeleteOldRecords(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;

    // Delete sessions
    const sessions = await prisma.session.deleteMany({
      where: {
        deleted_at: { lt: thirtyDaysAgo, not: null },
      },
    });
    totalDeleted += sessions.count;

    // Delete files
    const files = await prisma.sessionFile.deleteMany({
      where: {
        deleted_at: { lt: thirtyDaysAgo, not: null },
      },
    });
    totalDeleted += files.count;

    // Delete messages
    const messages = await prisma.message.deleteMany({
      where: {
        deleted_at: { lt: thirtyDaysAgo, not: null },
      },
    });
    totalDeleted += messages.count;

    // Delete users
    const users = await prisma.user.deleteMany({
      where: {
        deleted_at: { lt: thirtyDaysAgo, not: null },
      },
    });
    totalDeleted += users.count;

    if (totalDeleted > 0) {
      log.info(`Hard deleted ${totalDeleted} old soft-deleted records`);
    }

    return totalDeleted;
  } catch (error) {
    log.error('Failed to hard delete old records', error);
    return 0;
  }
}

// Run all cleanup jobs
export async function runAllCleanupJobs(): Promise<void> {
  log.info('Starting cleanup jobs...');

  const results = await Promise.allSettled([
    cleanupExpiredPasswordResets(),
    cleanupExpiredTokenBlacklist(),
    cleanupOldRateLimits(),
    cleanupOldAuditLogs(),
    archiveInactiveSessions(),
    hardDeleteOldRecords(),
  ]);

  const totalCleaned = results
    .filter((r) => r.status === 'fulfilled')
    .reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0);

  log.info(`Cleanup jobs completed. Total records cleaned: ${totalCleaned}`);
}

// Schedule cleanup jobs to run daily
export function startCleanupSchedule(): NodeJS.Timeout {
  log.info('Starting cleanup job schedule (runs daily at 2 AM)');

  // Run immediately on startup
  runAllCleanupJobs();

  // Then run daily at 2 AM
  const runDaily = () => {
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(2, 0, 0, 0);

    // If it's past 2 AM today, schedule for tomorrow
    if (now.getHours() >= 2) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const msUntilNextRun = nextRun.getTime() - now.getTime();

    return setTimeout(() => {
      runAllCleanupJobs();
      runDaily(); // Schedule next run
    }, msUntilNextRun);
  };

  return runDaily();
}

export default {
  cleanupExpiredPasswordResets,
  cleanupExpiredTokenBlacklist,
  cleanupOldRateLimits,
  cleanupOldAuditLogs,
  archiveInactiveSessions,
  hardDeleteOldRecords,
  runAllCleanupJobs,
  startCleanupSchedule,
};
