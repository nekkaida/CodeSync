// User service
// Handles user profile management and user-related operations

import { PrismaClient } from '@prisma/client';
import { NotFoundError, AuthorizationError } from '../utils/errors';
import { log } from '../utils/logger';

const prisma = new PrismaClient();

interface UpdateUserInput {
  name?: string;
  ai_cost_limit?: number;
}

export class UserService {
  // Get user by ID
  async getUserById(userId: string, requesterId?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        ai_cost_limit: true,
        created_at: true,
        updated_at: true,
        // Include sensitive info only if requesting own profile
        ...(userId === requesterId && {
          deleted_at: true,
        }),
      },
    });

    if (!user || user.deleted_at) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  // Update user profile
  async updateUser(userId: string, requesterId: string, input: UpdateUserInput) {
    // Users can only update their own profile (unless admin)
    if (userId !== requesterId) {
      const requester = await prisma.user.findUnique({
        where: { id: requesterId },
        select: { role: true },
      });

      if (requester?.role !== 'ADMIN') {
        throw new AuthorizationError("Cannot update another user's profile");
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: input,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        ai_cost_limit: true,
        updated_at: true,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: requesterId,
        action: 'UPDATE',
        resource_type: 'user',
        resource_id: userId,
        details: JSON.stringify(input),
      },
    });

    log.info('User updated', { userId, requesterId });

    return user;
  }

  // Delete user (soft delete)
  async deleteUser(userId: string, requesterId: string) {
    // Users can only delete their own account (unless admin)
    if (userId !== requesterId) {
      const requester = await prisma.user.findUnique({
        where: { id: requesterId },
        select: { role: true },
      });

      if (requester?.role !== 'ADMIN') {
        throw new AuthorizationError("Cannot delete another user's account");
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        deleted_at: new Date(),
        deleted_by: requesterId,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: requesterId,
        action: 'DELETE',
        resource_type: 'user',
        resource_id: userId,
        details: JSON.stringify({ deleted_by: requesterId }),
      },
    });

    log.info('User deleted', { userId, requesterId });
  }

  // Get user's sessions
  async getUserSessions(userId: string, limit: number = 20, offset: number = 0) {
    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where: {
          OR: [
            { owner_id: userId },
            { participants: { some: { user_id: userId, left_at: null } } },
          ],
          deleted_at: null,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          participants: {
            where: { left_at: null },
            select: {
              user_id: true,
              role: true,
            },
          },
        },
        orderBy: { last_activity: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.session.count({
        where: {
          OR: [
            { owner_id: userId },
            { participants: { some: { user_id: userId, left_at: null } } },
          ],
          deleted_at: null,
        },
      }),
    ]);

    return { sessions, total, limit, offset };
  }

  // Get user's AI usage statistics
  async getAIUsageStats(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const usage = await prisma.aIUsage.findMany({
      where: {
        user_id: userId,
        created_at: { gte: startDate },
      },
      orderBy: { created_at: 'desc' },
    });

    // Calculate totals
    const totalTokens = usage.reduce((sum, u) => sum + u.tokens_used, 0);
    const totalCost = usage.reduce((sum, u) => sum + u.cost_usd, 0);
    const totalRequests = usage.length;

    // Group by model
    const byModel = usage.reduce((acc: any, u) => {
      if (!acc[u.model]) {
        acc[u.model] = { tokens: 0, cost: 0, requests: 0 };
      }
      acc[u.model].tokens += u.tokens_used;
      acc[u.model].cost += u.cost_usd;
      acc[u.model].requests += 1;
      return acc;
    }, {});

    return {
      totalTokens,
      totalCost,
      totalRequests,
      byModel,
      usage: usage.slice(0, 20), // Return last 20 requests
    };
  }

  // Get user's audit log
  async getAuditLog(userId: string, limit: number = 50, offset: number = 0) {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({
        where: { user_id: userId },
      }),
    ]);

    return { logs, total, limit, offset };
  }

  // List all users (admin only)
  async listUsers(
    requesterId: string,
    filters: {
      role?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    // Check if requester is admin
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });

    if (requester?.role !== 'ADMIN') {
      throw new AuthorizationError('Admin access required');
    }

    const { role, limit = 50, offset = 0 } = filters;

    const where: any = {
      deleted_at: null,
    };

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          ai_cost_limit: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, limit, offset };
  }

  // Update user role (admin only)
  async updateUserRole(
    userId: string,
    newRole: 'USER' | 'ADMIN' | 'MODERATOR',
    requesterId: string,
  ) {
    // Check if requester is admin
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });

    if (requester?.role !== 'ADMIN') {
      throw new AuthorizationError('Admin access required');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: requesterId,
        action: 'UPDATE',
        resource_type: 'user',
        resource_id: userId,
        details: JSON.stringify({ role_changed_to: newRole }),
      },
    });

    log.info('User role updated', { userId, newRole, requesterId });

    return user;
  }
}

export default new UserService();
