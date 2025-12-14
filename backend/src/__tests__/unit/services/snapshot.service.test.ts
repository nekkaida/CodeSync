// Snapshot service tests
// Tests for code snapshots and version history

import { mockPrisma } from '../../setup';
import { NotFoundError, AuthorizationError } from '../../../utils/errors';
import snapshotService, { SnapshotService } from '../../../services/snapshot.service';

// Mock the notifications module
jest.mock('../../../utils/notifications', () => ({
  getSocketIOInstance: jest.fn().mockReturnValue({
    to: jest.fn().mockReturnValue({
      emit: jest.fn(),
    }),
  }),
}));

// Helper to create mock session
const createMockSession = (overrides: Partial<{
  id: string;
  name: string;
  owner_id: string;
  deleted_at: Date | null;
}> = {}) => ({
  id: 'session-123',
  name: 'Test Session',
  owner_id: 'owner-123',
  deleted_at: null,
  ...overrides,
});

// Helper to create mock snapshot
const createMockSnapshot = (overrides: Partial<{
  id: string;
  session_id: string;
  user_id: string;
  yjs_state: string;
  change_summary: string | null;
  lines_added: number;
  lines_removed: number;
  created_at: Date;
  user: { id: string; name: string; email: string };
  session: { id: string; name: string; owner_id: string };
}> = {}) => ({
  id: 'snapshot-123',
  session_id: 'session-123',
  user_id: 'user-123',
  yjs_state: 'encoded_yjs_state',
  change_summary: 'Added new feature',
  lines_added: 50,
  lines_removed: 10,
  created_at: new Date(),
  user: { id: 'user-123', name: 'Test User', email: 'test@example.com' },
  session: { id: 'session-123', name: 'Test Session', owner_id: 'owner-123' },
  ...overrides,
});

// Helper to create mock participant
const createMockParticipant = (overrides: Partial<{
  id: string;
  session_id: string;
  user_id: string;
  role: string;
  left_at: Date | null;
}> = {}) => ({
  id: 'participant-123',
  session_id: 'session-123',
  user_id: 'user-123',
  role: 'EDITOR',
  left_at: null,
  ...overrides,
});

describe('SnapshotService', () => {
  let service: SnapshotService;

  beforeEach(() => {
    service = new SnapshotService();
    jest.clearAllMocks();
  });

  describe('createSnapshot', () => {
    it('should create snapshot successfully as owner', async () => {
      const mockSession = createMockSession({ owner_id: 'user-123' });
      const mockSnapshot = createMockSnapshot();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.create.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.createSnapshot({
        sessionId: 'session-123',
        yjsState: 'encoded_state',
        changeSummary: 'Added feature',
        linesAdded: 50,
        linesRemoved: 10,
        userId: 'user-123',
      });

      expect(result).toEqual(mockSnapshot);
      expect(mockPrisma.codeSnapshot.create).toHaveBeenCalled();
    });

    it('should create snapshot successfully as participant', async () => {
      const mockSession = createMockSession();
      const mockParticipant = createMockParticipant();
      const mockSnapshot = createMockSnapshot();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(mockParticipant as any);
      mockPrisma.codeSnapshot.create.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.createSnapshot({
        sessionId: 'session-123',
        yjsState: 'encoded_state',
        userId: 'user-123',
      });

      expect(result).toEqual(mockSnapshot);
    });

    it('should throw NotFoundError when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        service.createSnapshot({
          sessionId: 'non-existent',
          yjsState: 'encoded_state',
          userId: 'user-123',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when session is deleted', async () => {
      const mockSession = createMockSession({ deleted_at: new Date() });
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      await expect(
        service.createSnapshot({
          sessionId: 'session-123',
          yjsState: 'encoded_state',
          userId: 'user-123',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user is not participant or owner', async () => {
      const mockSession = createMockSession();
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        service.createSnapshot({
          sessionId: 'session-123',
          yjsState: 'encoded_state',
          userId: 'unauthorized-user',
        }),
      ).rejects.toThrow(AuthorizationError);
    });

    it('should use default values for linesAdded and linesRemoved', async () => {
      const mockSession = createMockSession({ owner_id: 'user-123' });
      const mockSnapshot = createMockSnapshot({ lines_added: 0, lines_removed: 0 });

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.create.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.createSnapshot({
        sessionId: 'session-123',
        yjsState: 'encoded_state',
        userId: 'user-123',
      });

      expect(mockPrisma.codeSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lines_added: 0,
            lines_removed: 0,
          }),
        }),
      );
    });

    it('should create audit log entry', async () => {
      const mockSession = createMockSession({ owner_id: 'user-123' });
      const mockSnapshot = createMockSnapshot();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.create.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.createSnapshot({
        sessionId: 'session-123',
        yjsState: 'encoded_state',
        changeSummary: 'Test change',
        linesAdded: 10,
        linesRemoved: 5,
        userId: 'user-123',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'user-123',
          action: 'CREATE',
          resource_type: 'snapshot',
        }),
      });
    });
  });

  describe('listSnapshots', () => {
    it('should return snapshots for session owner', async () => {
      const mockSession = createMockSession({ owner_id: 'user-123' });
      const mockSnapshots = [createMockSnapshot(), createMockSnapshot({ id: 'snapshot-456' })];

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.findMany.mockResolvedValue(mockSnapshots as any);
      mockPrisma.codeSnapshot.count.mockResolvedValue(2);

      const result = await service.listSnapshots('session-123', 'user-123', { limit: 20, offset: 0 });

      expect(result.snapshots).toEqual(mockSnapshots);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should return snapshots for participant', async () => {
      const mockSession = createMockSession();
      const mockParticipant = createMockParticipant();
      const mockSnapshots = [createMockSnapshot()];

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(mockParticipant as any);
      mockPrisma.codeSnapshot.findMany.mockResolvedValue(mockSnapshots as any);
      mockPrisma.codeSnapshot.count.mockResolvedValue(1);

      const result = await service.listSnapshots('session-123', 'user-123', { limit: 10, offset: 0 });

      expect(result.snapshots).toEqual(mockSnapshots);
    });

    it('should throw NotFoundError when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        service.listSnapshots('non-existent', 'user-123', { limit: 20, offset: 0 }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user is not participant or owner', async () => {
      const mockSession = createMockSession();
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        service.listSnapshots('session-123', 'unauthorized-user', { limit: 20, offset: 0 }),
      ).rejects.toThrow(AuthorizationError);
    });

    it('should apply pagination', async () => {
      const mockSession = createMockSession({ owner_id: 'user-123' });
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.findMany.mockResolvedValue([]);
      mockPrisma.codeSnapshot.count.mockResolvedValue(0);

      await service.listSnapshots('session-123', 'user-123', { limit: 10, offset: 5 });

      expect(mockPrisma.codeSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        }),
      );
    });
  });

  describe('getSnapshot', () => {
    it('should return snapshot for owner', async () => {
      const mockSnapshot = createMockSnapshot({ session: { id: 'session-123', name: 'Test', owner_id: 'user-123' } });
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      const result = await service.getSnapshot('snapshot-123', 'user-123');

      expect(result).toEqual(mockSnapshot);
    });

    it('should return snapshot for participant', async () => {
      const mockSnapshot = createMockSnapshot();
      const mockParticipant = createMockParticipant();

      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst.mockResolvedValue(mockParticipant as any);

      const result = await service.getSnapshot('snapshot-123', 'user-123');

      expect(result).toEqual(mockSnapshot);
    });

    it('should throw NotFoundError when snapshot not found', async () => {
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(null);

      await expect(service.getSnapshot('non-existent', 'user-123')).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user is not participant or owner', async () => {
      const mockSnapshot = createMockSnapshot();
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(service.getSnapshot('snapshot-123', 'unauthorized-user')).rejects.toThrow(
        AuthorizationError,
      );
    });
  });

  describe('restoreSnapshot', () => {
    it('should restore snapshot as owner', async () => {
      const mockSnapshot = createMockSnapshot({
        session: { id: 'session-123', name: 'Test', owner_id: 'user-123' },
      });

      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst
        .mockResolvedValueOnce(null) // For getSnapshot auth check
        .mockResolvedValueOnce(null); // For restoreSnapshot edit check
      mockPrisma.codeSnapshot.create.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.restoreSnapshot('snapshot-123', 'user-123');

      expect(result.success).toBe(true);
      expect(result.snapshot).toEqual(mockSnapshot);
    });

    it('should restore snapshot as editor participant', async () => {
      const mockSnapshot = createMockSnapshot();
      const mockParticipant = createMockParticipant({ role: 'EDITOR' });

      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst
        .mockResolvedValueOnce(mockParticipant as any) // For getSnapshot auth check
        .mockResolvedValueOnce(mockParticipant as any); // For restoreSnapshot edit check
      mockPrisma.codeSnapshot.create.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.restoreSnapshot('snapshot-123', 'user-123');

      expect(result.success).toBe(true);
    });

    it('should throw AuthorizationError when user has no edit permissions', async () => {
      const mockSnapshot = createMockSnapshot();
      const mockViewerParticipant = createMockParticipant({ role: 'VIEWER' });

      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst
        .mockResolvedValueOnce(mockViewerParticipant as any) // For getSnapshot auth check
        .mockResolvedValueOnce(null); // For restoreSnapshot edit check (no edit role)

      await expect(service.restoreSnapshot('snapshot-123', 'user-123')).rejects.toThrow(
        AuthorizationError,
      );
    });

    it('should create safety snapshot before restore', async () => {
      const mockSnapshot = createMockSnapshot({
        session: { id: 'session-123', name: 'Test', owner_id: 'user-123' },
      });

      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.create.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.restoreSnapshot('snapshot-123', 'user-123');

      expect(mockPrisma.codeSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          session_id: 'session-123',
          change_summary: expect.stringContaining('Restored from snapshot'),
        }),
      });
    });

    it('should create audit log entry', async () => {
      const mockSnapshot = createMockSnapshot({
        session: { id: 'session-123', name: 'Test', owner_id: 'user-123' },
      });

      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.create.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.restoreSnapshot('snapshot-123', 'user-123');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'user-123',
          action: 'RESTORE',
          resource_type: 'snapshot',
        }),
      });
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete snapshot as creator', async () => {
      const mockSnapshot = createMockSnapshot({ user_id: 'user-123' });

      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant() as any);
      mockPrisma.codeSnapshot.delete.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.deleteSnapshot('snapshot-123', 'user-123');

      expect(mockPrisma.codeSnapshot.delete).toHaveBeenCalledWith({
        where: { id: 'snapshot-123' },
      });
    });

    it('should delete snapshot as session owner', async () => {
      const mockSnapshot = createMockSnapshot({
        user_id: 'other-user',
        session: { id: 'session-123', name: 'Test', owner_id: 'owner-123' },
      });

      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.codeSnapshot.delete.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.deleteSnapshot('snapshot-123', 'owner-123');

      expect(mockPrisma.codeSnapshot.delete).toHaveBeenCalled();
    });

    it('should throw AuthorizationError when user is not creator or owner', async () => {
      const mockSnapshot = createMockSnapshot({
        user_id: 'other-user',
        session: { id: 'session-123', name: 'Test', owner_id: 'owner-123' },
      });

      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant() as any);

      await expect(service.deleteSnapshot('snapshot-123', 'unauthorized-user')).rejects.toThrow(
        AuthorizationError,
      );
    });

    it('should create audit log entry', async () => {
      const mockSnapshot = createMockSnapshot({ user_id: 'user-123' });

      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant() as any);
      mockPrisma.codeSnapshot.delete.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.deleteSnapshot('snapshot-123', 'user-123');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'user-123',
          action: 'DELETE',
          resource_type: 'snapshot',
        }),
      });
    });
  });

  describe('default export', () => {
    it('should export a SnapshotService instance', () => {
      expect(snapshotService).toBeInstanceOf(SnapshotService);
    });
  });
});
