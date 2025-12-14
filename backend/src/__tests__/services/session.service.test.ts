// Session service unit tests
// Tests session management logic

import { mockDeep, mockReset } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

const mockPrisma = mockDeep<PrismaClient>();

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

// Mock metrics
jest.mock('../../utils/metrics', () => ({
  sessionsActive: { inc: jest.fn(), dec: jest.fn() },
}));

// Import after mocking
import { SessionService } from '../../services/session.service';

describe('SessionService', () => {
  let sessionService: SessionService;

  const USER_ID = 'cluser00000000000001';
  const USER_ID_2 = 'cluser00000000000002';
  const SESSION_ID = 'clsession00000000001';
  const FILE_ID = 'clfile000000000000001';

  const mockSession = {
    id: SESSION_ID,
    name: 'Test Session',
    description: 'A test session',
    language: 'typescript',
    visibility: 'PRIVATE',
    status: 'ACTIVE',
    owner_id: USER_ID,
    deleted_at: null,
    deleted_by: null,
    last_activity: new Date(),
    participants_count: 1,
    created_at: new Date(),
    updated_at: new Date(),
    owner: {
      id: USER_ID,
      name: 'Test User',
      email: 'test@example.com',
    },
    participants: [
      { user_id: USER_ID, role: 'OWNER', left_at: null },
    ],
    files: [],
  };

  beforeEach(() => {
    mockReset(mockPrisma);
    sessionService = new SessionService();
  });

  describe('createSession', () => {
    it('should create a session successfully', async () => {
      mockPrisma.session.create.mockResolvedValue(mockSession as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await sessionService.createSession({
        name: 'Test Session',
        description: 'A test session',
        language: 'typescript' as any,
        visibility: 'PRIVATE' as any,
        ownerId: USER_ID,
      });

      expect(result.name).toBe('Test Session');
      expect(mockPrisma.session.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should create owner as participant', async () => {
      mockPrisma.session.create.mockResolvedValue(mockSession as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await sessionService.createSession({
        name: 'Test Session',
        language: 'typescript' as any,
        visibility: 'PRIVATE' as any,
        ownerId: USER_ID,
      });

      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            participants: expect.objectContaining({
              create: expect.objectContaining({
                user_id: USER_ID,
                role: 'OWNER',
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('getSession', () => {
    it('should return session for owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      const result = await sessionService.getSession(SESSION_ID, USER_ID);

      expect(result.id).toBe(SESSION_ID);
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(sessionService.getSession(SESSION_ID, USER_ID)).rejects.toThrow('Session not found');
    });

    it('should throw NotFoundError for deleted session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        deleted_at: new Date(),
      } as any);

      await expect(sessionService.getSession(SESSION_ID, USER_ID)).rejects.toThrow('Session not found');
    });

    it('should throw AuthorizationError for private session access by non-participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'other-owner',
        participants: [],
      } as any);

      await expect(sessionService.getSession(SESSION_ID, USER_ID)).rejects.toThrow('Access denied');
    });

    it('should allow access to public session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        visibility: 'PUBLIC',
        owner_id: 'other-owner',
        participants: [],
      } as any);

      const result = await sessionService.getSession(SESSION_ID, USER_ID);
      expect(result.id).toBe(SESSION_ID);
    });
  });

  describe('listSessions', () => {
    it('should list sessions', async () => {
      mockPrisma.session.findMany.mockResolvedValue([mockSession] as any);
      mockPrisma.session.count.mockResolvedValue(1);

      const result = await sessionService.listSessions({
        userId: USER_ID,
        limit: 20,
        offset: 0,
      });

      expect(result.sessions).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by visibility', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      await sessionService.listSessions({
        visibility: 'PUBLIC' as any,
      });

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visibility: 'PUBLIC',
          }),
        }),
      );
    });

    it('should filter by language', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      await sessionService.listSessions({
        language: 'typescript' as any,
      });

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            language: 'typescript',
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      await sessionService.listSessions({
        status: 'ACTIVE' as any,
      });

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        }),
      );
    });
  });

  describe('updateSession', () => {
    it('should update session as owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.session.update.mockResolvedValue({
        ...mockSession,
        name: 'Updated Session',
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await sessionService.updateSession(SESSION_ID, USER_ID, {
        name: 'Updated Session',
      });

      expect(result.name).toBe('Updated Session');
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.updateSession(SESSION_ID, USER_ID, { name: 'New' }),
      ).rejects.toThrow('Session not found');
    });

    it('should throw AuthorizationError for non-owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'other-owner',
      } as any);

      await expect(
        sessionService.updateSession(SESSION_ID, USER_ID, { name: 'New' }),
      ).rejects.toThrow('Only session owner can update settings');
    });
  });

  describe('deleteSession', () => {
    it('should delete session as owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.session.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await sessionService.deleteSession(SESSION_ID, USER_ID);

      expect(mockPrisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deleted_at: expect.any(Date),
            deleted_by: USER_ID,
          }),
        }),
      );
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(sessionService.deleteSession(SESSION_ID, USER_ID)).rejects.toThrow('Session not found');
    });

    it('should throw AuthorizationError for non-owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'other-owner',
      } as any);

      await expect(sessionService.deleteSession(SESSION_ID, USER_ID)).rejects.toThrow('Only session owner can delete session');
    });
  });

  describe('addParticipant', () => {
    it('should add participant to session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.participant.create.mockResolvedValue({
        id: 'participant-1',
        session_id: SESSION_ID,
        user_id: USER_ID_2,
        role: 'EDITOR',
        user: { id: USER_ID_2, name: 'User 2', email: 'user2@example.com' },
      } as any);
      mockPrisma.session.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await sessionService.addParticipant({
        sessionId: SESSION_ID,
        userId: USER_ID_2,
        role: 'EDITOR' as any,
      });

      expect(result.user_id).toBe(USER_ID_2);
    });

    it('should throw ValidationError if already participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue({
        id: 'existing-participant',
        user_id: USER_ID_2,
      } as any);

      await expect(
        sessionService.addParticipant({
          sessionId: SESSION_ID,
          userId: USER_ID_2,
          role: 'EDITOR' as any,
        }),
      ).rejects.toThrow('User is already a participant');
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.addParticipant({
          sessionId: SESSION_ID,
          userId: USER_ID_2,
          role: 'EDITOR' as any,
        }),
      ).rejects.toThrow('Session not found');
    });
  });

  describe('removeParticipant', () => {
    it('should remove participant from session', async () => {
      mockPrisma.participant.findFirst.mockResolvedValue({
        id: 'participant-1',
        session_id: SESSION_ID,
        user_id: USER_ID_2,
        role: 'EDITOR',
      } as any);
      mockPrisma.participant.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await sessionService.removeParticipant(SESSION_ID, USER_ID_2, USER_ID);

      expect(mockPrisma.participant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            left_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundError for non-existent participant', async () => {
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.removeParticipant(SESSION_ID, USER_ID_2, USER_ID),
      ).rejects.toThrow('Participant not found');
    });
  });

  describe('updateSessionContent', () => {
    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.updateSessionContent(SESSION_ID, USER_ID, 'content'),
      ).rejects.toThrow('Session not found');
    });

    it('should throw AuthorizationError for non-participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'other-user',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.updateSessionContent(SESSION_ID, USER_ID, 'content'),
      ).rejects.toThrow('Not authorized to update session content');
    });
  });

  describe('updateCursorPosition', () => {
    it('should update cursor position', async () => {
      mockPrisma.participant.updateMany.mockResolvedValue({ count: 1 });

      await sessionService.updateCursorPosition(SESSION_ID, USER_ID, 10, 5);

      expect(mockPrisma.participant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cursor_line: 10,
            cursor_column: 5,
          }),
        }),
      );
    });
  });

  describe('createFile', () => {
    it('should create file as owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.sessionFile.create.mockResolvedValue({
        id: FILE_ID,
        session_id: SESSION_ID,
        name: 'test.ts',
        type: 'file',
        path: 'test.ts',
      } as any);

      const result = await sessionService.createFile(SESSION_ID, USER_ID, 'test.ts', 'file');

      expect(result.name).toBe('test.ts');
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.createFile(SESSION_ID, USER_ID, 'test.ts', 'file'),
      ).rejects.toThrow('Session not found');
    });

    it('should throw AuthorizationError for non-participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'other-owner',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.createFile(SESSION_ID, USER_ID, 'test.ts', 'file'),
      ).rejects.toThrow('Not authorized to create files');
    });
  });

  describe('deleteFile', () => {
    it('should delete file as owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.sessionFile.update.mockResolvedValue({} as any);

      await sessionService.deleteFile(SESSION_ID, USER_ID, FILE_ID);

      expect(mockPrisma.sessionFile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deleted_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.deleteFile(SESSION_ID, USER_ID, FILE_ID),
      ).rejects.toThrow('Session not found');
    });

    it('should throw AuthorizationError for non-participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'other-user',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.deleteFile(SESSION_ID, USER_ID, FILE_ID),
      ).rejects.toThrow('Not authorized to delete files');
    });
  });

  describe('getFileContent', () => {
    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.getFileContent(SESSION_ID, USER_ID, 'test.ts'),
      ).rejects.toThrow('Session not found');
    });

    it('should throw AuthorizationError for private session non-participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'other-user',
        visibility: 'PRIVATE',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.getFileContent(SESSION_ID, USER_ID, 'test.ts'),
      ).rejects.toThrow('Not authorized to access this session');
    });
  });

  describe('updateFileContent', () => {
    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.updateFileContent(SESSION_ID, USER_ID, 'test.ts', 'content'),
      ).rejects.toThrow('Session not found');
    });

    it('should throw AuthorizationError for non-participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'other-user',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.updateFileContent(SESSION_ID, USER_ID, 'test.ts', 'content'),
      ).rejects.toThrow('Not authorized to edit this session');
    });
  });

  describe('searchFiles', () => {
    it('should search files in session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        visibility: 'PUBLIC',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.sessionFile.findMany.mockResolvedValue([
        {
          path: 'test.ts',
          content: 'const test = "hello world";',
        },
      ] as any);

      const results = await sessionService.searchFiles(SESSION_ID, USER_ID, 'hello');

      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe('test.ts');
    });

    it('should throw ValidationError for invalid regex', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        visibility: 'PUBLIC',
      } as any);
      mockPrisma.sessionFile.findMany.mockResolvedValue([]);

      await expect(
        sessionService.searchFiles(SESSION_ID, USER_ID, '[invalid', { regex: true }),
      ).rejects.toThrow('Invalid search pattern');
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.searchFiles(SESSION_ID, USER_ID, 'test'),
      ).rejects.toThrow('Session not found');
    });

    it('should throw AuthorizationError for private session non-participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'other-user',
        visibility: 'PRIVATE',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.searchFiles(SESSION_ID, USER_ID, 'test'),
      ).rejects.toThrow('Not authorized to access this session');
    });

    it('should handle zero-length regex matches', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        visibility: 'PUBLIC',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.sessionFile.findMany.mockResolvedValue([
        {
          path: 'test.ts',
          content: 'aaa',
        },
      ] as any);

      // Empty match regex that could cause infinite loop without proper handling
      const results = await sessionService.searchFiles(SESSION_ID, USER_ID, 'a*', { regex: true });

      // Should find matches without infinite looping
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
