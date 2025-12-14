// Session service tests
// Unit tests for session management functionality

import { SessionService } from '../../services/session.service';
import { mockPrisma } from '../setup';
import { NotFoundError, AuthorizationError } from '../../utils/errors';

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    sessionService = new SessionService();
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Test Session',
        description: 'A test session',
        language: 'javascript',
        owner_id: 'user-1',
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        max_participants: 10,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };

      mockPrisma.session.create.mockResolvedValue(mockSession as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await sessionService.createSession({
        name: 'Test Session',
        description: 'A test session',
        language: 'javascript',
        visibility: 'PRIVATE',
        ownerId: 'user-1',
      });

      expect(result).toMatchObject({
        id: 'session-1',
        name: 'Test Session',
        language: 'javascript',
      });
      expect(mockPrisma.session.create).toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('should return session for owner', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Test Session',
        owner_id: 'user-1',
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        deleted_at: null,
        owner: {
          id: 'user-1',
          name: 'Owner',
          email: 'owner@example.com',
        },
        participants: [],
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      const result = await sessionService.getSession('session-1', 'user-1');

      expect(result.id).toBe('session-1');
    });

    it('should return session for participant', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Test Session',
        owner_id: 'user-1',
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        deleted_at: null,
        owner: {
          id: 'user-1',
          name: 'Owner',
          email: 'owner@example.com',
        },
        participants: [
          {
            user_id: 'user-2',
            left_at: null,
          },
        ],
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      const result = await sessionService.getSession('session-1', 'user-2');

      expect(result.id).toBe('session-1');
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(sessionService.getSession('session-1', 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw AuthorizationError for unauthorized access', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Test Session',
        owner_id: 'user-1',
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        deleted_at: null,
        owner: {
          id: 'user-1',
          name: 'Owner',
          email: 'owner@example.com',
        },
        participants: [],
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      await expect(sessionService.getSession('session-1', 'user-2')).rejects.toThrow(
        AuthorizationError,
      );
    });
  });

  describe('updateSession', () => {
    it('should update session for owner', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Test Session',
        owner_id: 'user-1',
        status: 'ACTIVE',
        deleted_at: null,
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.session.update.mockResolvedValue({
        ...mockSession,
        name: 'Updated Session',
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await sessionService.updateSession('session-1', 'user-1', {
        name: 'Updated Session',
      });

      expect(result.name).toBe('Updated Session');
      expect(mockPrisma.session.update).toHaveBeenCalled();
    });

    it('should throw AuthorizationError for non-owner', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Test Session',
        owner_id: 'user-1',
        status: 'ACTIVE',
        deleted_at: null,
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      await expect(
        sessionService.updateSession('session-1', 'user-2', {
          name: 'Updated Session',
        }),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('deleteSession', () => {
    it('should soft delete session for owner', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Test Session',
        owner_id: 'user-1',
        status: 'ACTIVE',
        deleted_at: null,
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.session.update.mockResolvedValue({
        ...mockSession,
        deleted_at: new Date(),
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await sessionService.deleteSession('session-1', 'user-1');

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { deleted_at: expect.any(Date), deleted_by: 'user-1' },
      });
    });

    it('should throw AuthorizationError for non-owner', async () => {
      const mockSession = {
        id: 'session-1',
        name: 'Test Session',
        owner_id: 'user-1',
        status: 'ACTIVE',
        deleted_at: null,
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      await expect(sessionService.deleteSession('session-1', 'user-2')).rejects.toThrow(
        AuthorizationError,
      );
    });
  });

  describe('addParticipant', () => {
    it('should add participant to session', async () => {
      const mockSession = {
        id: 'session-1',
        owner_id: 'user-1',
        max_participants: 10,
        status: 'ACTIVE',
        deleted_at: null,
      };

      const mockUser = {
        id: 'user-2',
        email: 'participant@example.com',
        deleted_at: null,
      };

      const mockParticipant = {
        id: 'participant-1',
        session_id: 'session-1',
        user_id: 'user-2',
        role: 'VIEWER',
        joined_at: new Date(),
        left_at: null,
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.participant.count.mockResolvedValue(5);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.participant.create.mockResolvedValue(mockParticipant as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await sessionService.addParticipant({
        sessionId: 'session-1',
        userId: 'user-2',
        role: 'VIEWER',
      });

      expect(result.user_id).toBe('user-2');
      expect(mockPrisma.participant.create).toHaveBeenCalled();
    });
  });
});
