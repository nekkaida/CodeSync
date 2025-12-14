// Snapshot service
// Handles code snapshots and version history

import { PrismaClient } from '@prisma/client';
import { NotFoundError, AuthorizationError } from '../utils/errors';
import { log } from '../utils/logger';
import { getSocketIOInstance } from '../utils/notifications';
import { SOCKET_EVENTS } from '../contracts/socket-events';

const prisma = new PrismaClient();

interface CreateSnapshotInput {
  sessionId: string;
  yjsState: string;
  changeSummary?: string;
  linesAdded?: number;
  linesRemoved?: number;
  userId: string;
}

export class SnapshotService {
  // Create snapshot
  async createSnapshot(input: CreateSnapshotInput) {
    const { sessionId, yjsState, changeSummary, linesAdded, linesRemoved, userId } = input;

    // Check if session exists and user has access
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    // Check if user is participant
    const participant = await prisma.participant.findFirst({
      where: {
        session_id: sessionId,
        user_id: userId,
        left_at: null,
      },
    });

    if (!participant && session.owner_id !== userId) {
      throw new AuthorizationError('Not authorized to create snapshots');
    }

    // Create snapshot
    const snapshot = await prisma.codeSnapshot.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        yjs_state: yjsState,
        change_summary: changeSummary,
        lines_added: linesAdded || 0,
        lines_removed: linesRemoved || 0,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CREATE',
        resource_type: 'snapshot',
        resource_id: snapshot.id,
        details: JSON.stringify({
          sessionId,
          changeSummary,
          linesAdded,
          linesRemoved,
        }),
      },
    });

    log.info('Snapshot created', { snapshotId: snapshot.id, sessionId, userId });

    return snapshot;
  }

  // List snapshots for session
  async listSnapshots(
    sessionId: string,
    userId: string,
    options: { limit: number; offset: number },
  ) {
    // Check if session exists and user has access
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    // Check if user is participant
    const participant = await prisma.participant.findFirst({
      where: {
        session_id: sessionId,
        user_id: userId,
        left_at: null,
      },
    });

    if (!participant && session.owner_id !== userId) {
      throw new AuthorizationError('Not authorized to view snapshots');
    }

    const [snapshots, total] = await Promise.all([
      prisma.codeSnapshot.findMany({
        where: { session_id: sessionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        take: options.limit,
        skip: options.offset,
      }),
      prisma.codeSnapshot.count({
        where: { session_id: sessionId },
      }),
    ]);

    return {
      snapshots,
      total,
      limit: options.limit,
      offset: options.offset,
    };
  }

  // Get snapshot by ID
  async getSnapshot(snapshotId: string, userId: string) {
    const snapshot = await prisma.codeSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        session: {
          select: {
            id: true,
            name: true,
            owner_id: true,
          },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundError('Snapshot not found');
    }

    // Check if user has access to the session
    const participant = await prisma.participant.findFirst({
      where: {
        session_id: snapshot.session_id,
        user_id: userId,
        left_at: null,
      },
    });

    if (!participant && snapshot.session.owner_id !== userId) {
      throw new AuthorizationError('Not authorized to view this snapshot');
    }

    return snapshot;
  }

  // Restore snapshot
  async restoreSnapshot(snapshotId: string, userId: string) {
    const snapshot = await this.getSnapshot(snapshotId, userId);

    // Check if user has edit permissions
    const participant = await prisma.participant.findFirst({
      where: {
        session_id: snapshot.session_id,
        user_id: userId,
        role: { in: ['OWNER', 'EDITOR'] },
        left_at: null,
      },
    });

    if (!participant && snapshot.session.owner_id !== userId) {
      throw new AuthorizationError('Not authorized to restore snapshots');
    }

    // Create a new snapshot before restoring (for safety)
    await prisma.codeSnapshot.create({
      data: {
        session_id: snapshot.session_id,
        user_id: userId,
        yjs_state: snapshot.yjs_state,
        change_summary: `Restored from snapshot ${snapshotId}`,
        lines_added: 0,
        lines_removed: 0,
      },
    });

    // Broadcast restore event to all connected clients
    const io = getSocketIOInstance();
    if (io) {
      io.to(`session:${snapshot.session_id}`).emit(SOCKET_EVENTS.SNAPSHOT_RESTORED, {
        snapshotId,
        sessionId: snapshot.session_id,
        yjsState: snapshot.yjs_state,
        restoredBy: userId,
        timestamp: new Date(),
      });
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'RESTORE',
        resource_type: 'snapshot',
        resource_id: snapshotId,
        details: JSON.stringify({
          sessionId: snapshot.session_id,
        }),
      },
    });

    log.info('Snapshot restored', { snapshotId, sessionId: snapshot.session_id, userId });

    return {
      success: true,
      snapshot,
      message: 'Snapshot restored successfully. Connected editors will update automatically.',
    };
  }

  // Delete snapshot
  async deleteSnapshot(snapshotId: string, userId: string) {
    const snapshot = await this.getSnapshot(snapshotId, userId);

    // Only owner or snapshot creator can delete
    if (snapshot.user_id !== userId && snapshot.session.owner_id !== userId) {
      throw new AuthorizationError('Not authorized to delete this snapshot');
    }

    await prisma.codeSnapshot.delete({
      where: { id: snapshotId },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'DELETE',
        resource_type: 'snapshot',
        resource_id: snapshotId,
        details: JSON.stringify({
          sessionId: snapshot.session_id,
        }),
      },
    });

    log.info('Snapshot deleted', { snapshotId, userId });
  }
}

export default new SnapshotService();
