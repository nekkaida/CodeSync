// Snapshot service tests
// Tests for code snapshots and version history

import { mockPrisma } from '../setup';
import { SnapshotService } from '../../services/snapshot.service';
import { NotFoundError, AuthorizationError } from '../../utils/errors';

// Mock notifications
jest.mock('../../utils/notifications', () => ({
  getSocketIOInstance: jest.fn().mockReturnValue({
    to: jest.fn().mockReturnValue({
      emit: jest.fn(),
    }),
  }),
  sendNotification: jest.fn(),
}));

// Create fresh instance for testing
const snapshotService = new SnapshotService();

describe('SnapshotService', () => {
  const mockSession = {
    id: 'session-1',
    name: 'Test Session',
    description: 'A test session',
    language: 'typescript',
    visibility: 'PRIVATE',
    status: 'ACTIVE',
    owner_id: 'owner-1',
    deleted_at: null,
    deleted_by: null,
    last_activity: new Date(),
    participants_count: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSnapshot = {
    id: 'snapshot-1',
    session_id: 'session-1',
    user_id: 'user-1',
    yjs_state: 'encoded-yjs-state-data',
    change_summary: 'Initial commit',
    lines_added: 10,
    lines_removed: 0,
    created_at: new Date(),
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
    },
    session: {
      id: 'session-1',
      name: 'Test Session',
      owner_id: 'owner-1',
    },
  };

  const mockParticipant = {
    id: 'participant-1',
    session_id: 'session-1',
    user_id: 'user-1',
    role: 'EDITOR' as const,
    left_at: null,
  };

  describe('createSnapshot', () => {
    it('should create a snapshot as session owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.create.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await snapshotService.createSnapshot({
        sessionId: 'session-1',
        yjsState: 'encoded-yjs-state',
        changeSummary: 'Added new function',
        linesAdded: 15,
        linesRemoved: 3,
        userId: 'owner-1',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.codeSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          session_id: 'session-1',
          user_id: 'owner-1',
          yjs_state: 'encoded-yjs-state',
          change_summary: 'Added new function',
          lines_added: 15,
          lines_removed: 3,
        }),
        include: expect.any(Object),
      });
    });

    it('should create a snapshot as participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'different-owner',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(mockParticipant as any);
      mockPrisma.codeSnapshot.create.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await snapshotService.createSnapshot({
        sessionId: 'session-1',
        yjsState: 'encoded-yjs-state',
        userId: 'user-1',
      });

      expect(result).toBeDefined();
    });

    it('should use default values for lines added/removed', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.create.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await snapshotService.createSnapshot({
        sessionId: 'session-1',
        yjsState: 'encoded-yjs-state',
        userId: 'owner-1',
      });

      expect(mockPrisma.codeSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          lines_added: 0,
          lines_removed: 0,
        }),
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        snapshotService.createSnapshot({
          sessionId: 'non-existent',
          yjsState: 'state',
          userId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError for deleted session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        deleted_at: new Date(),
      } as any);

      await expect(
        snapshotService.createSnapshot({
          sessionId: 'session-1',
          yjsState: 'state',
          userId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError for non-participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'different-owner',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        snapshotService.createSnapshot({
          sessionId: 'session-1',
          yjsState: 'state',
          userId: 'outsider',
        }),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('listSnapshots', () => {
    it('should list snapshots for session owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.findMany.mockResolvedValue([mockSnapshot] as any);
      mockPrisma.codeSnapshot.count.mockResolvedValue(1);

      const result = await snapshotService.listSnapshots('session-1', 'owner-1', {
        limit: 20,
        offset: 0,
      });

      expect(result.snapshots).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should list snapshots for participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'different-owner',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(mockParticipant as any);
      mockPrisma.codeSnapshot.findMany.mockResolvedValue([mockSnapshot] as any);
      mockPrisma.codeSnapshot.count.mockResolvedValue(1);

      const result = await snapshotService.listSnapshots('session-1', 'user-1', {
        limit: 10,
        offset: 5,
      });

      expect(result.snapshots).toHaveLength(1);
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        snapshotService.listSnapshots('non-existent', 'user-1', { limit: 20, offset: 0 }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError for non-participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'different-owner',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        snapshotService.listSnapshots('session-1', 'outsider', { limit: 20, offset: 0 }),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('getSnapshot', () => {
    it('should get snapshot by id for session owner', async () => {
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      const result = await snapshotService.getSnapshot('snapshot-1', 'owner-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('snapshot-1');
    });

    it('should get snapshot by id for participant', async () => {
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue({
        ...mockSnapshot,
        session: { ...mockSnapshot.session, owner_id: 'different-owner' },
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(mockParticipant as any);

      const result = await snapshotService.getSnapshot('snapshot-1', 'user-1');

      expect(result).toBeDefined();
    });

    it('should throw NotFoundError for non-existent snapshot', async () => {
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(null);

      await expect(snapshotService.getSnapshot('non-existent', 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw AuthorizationError for non-participant', async () => {
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue({
        ...mockSnapshot,
        session: { ...mockSnapshot.session, owner_id: 'different-owner' },
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(snapshotService.getSnapshot('snapshot-1', 'outsider')).rejects.toThrow(
        AuthorizationError,
      );
    });
  });

  describe('restoreSnapshot', () => {
    it('should restore snapshot as session owner', async () => {
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst
        .mockResolvedValueOnce(null) // getSnapshot check
        .mockResolvedValueOnce(null); // restore check
      mockPrisma.codeSnapshot.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await snapshotService.restoreSnapshot('snapshot-1', 'owner-1');

      expect(result.success).toBe(true);
      expect(mockPrisma.codeSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          change_summary: expect.stringContaining('Restored from snapshot'),
        }),
      });
    });

    it('should restore snapshot as editor', async () => {
      const editorParticipant = { ...mockParticipant, role: 'EDITOR' as const };
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue({
        ...mockSnapshot,
        session: { ...mockSnapshot.session, owner_id: 'different-owner' },
      } as any);
      mockPrisma.participant.findFirst
        .mockResolvedValueOnce(editorParticipant as any) // getSnapshot check
        .mockResolvedValueOnce(editorParticipant as any); // restore check
      mockPrisma.codeSnapshot.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await snapshotService.restoreSnapshot('snapshot-1', 'user-1');

      expect(result.success).toBe(true);
    });

    it('should broadcast restore event via socket', async () => {
      const { getSocketIOInstance } = require('../../utils/notifications');
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      getSocketIOInstance.mockReturnValue({ to: mockTo });

      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await snapshotService.restoreSnapshot('snapshot-1', 'owner-1');

      expect(mockTo).toHaveBeenCalledWith('session:session-1');
      expect(mockEmit).toHaveBeenCalled();
    });

    it('should throw AuthorizationError for viewer', async () => {
      const viewerParticipant = { ...mockParticipant, role: 'VIEWER' as const };
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue({
        ...mockSnapshot,
        session: { ...mockSnapshot.session, owner_id: 'different-owner' },
      } as any);
      mockPrisma.participant.findFirst
        .mockResolvedValueOnce(viewerParticipant as any) // getSnapshot check
        .mockResolvedValueOnce(null); // restore check - viewer not found with OWNER/EDITOR role

      await expect(snapshotService.restoreSnapshot('snapshot-1', 'viewer-1')).rejects.toThrow(
        AuthorizationError,
      );
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete snapshot as creator', async () => {
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst.mockResolvedValue(mockParticipant as any);
      mockPrisma.codeSnapshot.delete.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await snapshotService.deleteSnapshot('snapshot-1', 'user-1');

      expect(mockPrisma.codeSnapshot.delete).toHaveBeenCalledWith({
        where: { id: 'snapshot-1' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should delete snapshot as session owner', async () => {
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue({
        ...mockSnapshot,
        user_id: 'different-user',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.delete.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await snapshotService.deleteSnapshot('snapshot-1', 'owner-1');

      expect(mockPrisma.codeSnapshot.delete).toHaveBeenCalled();
    });

    it('should throw AuthorizationError for non-creator/non-owner', async () => {
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue({
        ...mockSnapshot,
        user_id: 'different-user',
        session: { ...mockSnapshot.session, owner_id: 'different-owner' },
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(mockParticipant as any);

      await expect(snapshotService.deleteSnapshot('snapshot-1', 'random-user')).rejects.toThrow(
        AuthorizationError,
      );
    });
  });
});
