// Session service unit tests
// Tests for collaborative coding session management

import { ProgrammingLanguage, SessionVisibility, ParticipantRole, SessionStatus } from '@prisma/client';
import { NotFoundError, AuthorizationError, ValidationError } from '../../../utils/errors';

// Mock metrics
jest.mock('../../../utils/metrics', () => ({
  sessionsActive: {
    inc: jest.fn(),
    dec: jest.fn(),
  },
}));

// Get the mock prisma
import { mockPrisma } from '../../setup';

// Import after mocks are set up
import { SessionService } from '../../../services/session.service';

// Helper to create mock session
const createMockSession = (
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    language: ProgrammingLanguage;
    visibility: SessionVisibility;
    status: SessionStatus;
    owner_id: string;
    created_at: Date;
    updated_at: Date;
    last_activity: Date;
    deleted_at: Date | null;
    deleted_by: string | null;
    participants_count: number;
  }> = {}
) => ({
  id: 'session-123',
  name: 'Test Session',
  description: 'Test description',
  language: 'typescript' as ProgrammingLanguage,
  visibility: 'PUBLIC' as SessionVisibility,
  status: 'ACTIVE' as SessionStatus,
  owner_id: 'user-123',
  created_at: new Date(),
  updated_at: new Date(),
  last_activity: new Date(),
  deleted_at: null,
  deleted_by: null,
  participants_count: 1,
  ...overrides,
});

// Helper to create mock participant
const createMockParticipant = (
  overrides: Partial<{
    id: string;
    session_id: string;
    user_id: string;
    role: ParticipantRole;
    cursor_line: number | null;
    cursor_column: number | null;
    cursor_color: string | null;
    joined_at: Date;
    left_at: Date | null;
    last_seen: Date;
  }> = {}
) => ({
  id: 'participant-123',
  session_id: 'session-123',
  user_id: 'user-123',
  role: 'OWNER' as ParticipantRole,
  cursor_line: null,
  cursor_column: null,
  cursor_color: null,
  joined_at: new Date(),
  left_at: null,
  last_seen: new Date(),
  ...overrides,
});

// Helper to create mock user
const createMockUser = (
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
  }> = {}
) => ({
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  ...overrides,
});

// Helper to create mock file
const createMockFile = (
  overrides: Partial<{
    id: string;
    session_id: string;
    name: string;
    type: string;
    path: string;
    content: string | null;
    yjs_state: string | null;
    original_name: string | null;
    stored_name: string | null;
    mime_type: string | null;
    size: number | null;
    is_binary: boolean;
    uploaded_by: string | null;
    storage_key: string | null;
    storage_url: string | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
  }> = {}
) => ({
  id: 'file-123',
  session_id: 'session-123',
  name: 'test.ts',
  type: 'file',
  path: 'test.ts',
  content: 'console.log("hello");',
  yjs_state: null,
  original_name: null,
  stored_name: null,
  mime_type: null,
  size: null,
  is_binary: false,
  uploaded_by: null,
  storage_key: null,
  storage_url: null,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  ...overrides,
});

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    sessionService = new SessionService();
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session with owner as participant', async () => {
      const mockSession = {
        ...createMockSession(),
        owner: createMockUser(),
        participants: [
          {
            ...createMockParticipant(),
            user: createMockUser(),
          },
        ],
      };

      mockPrisma.session.create.mockResolvedValue(mockSession);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await sessionService.createSession({
        name: 'Test Session',
        description: 'Test description',
        language: 'typescript' as ProgrammingLanguage,
        visibility: 'PUBLIC' as SessionVisibility,
        ownerId: 'user-123',
      });

      expect(result).toEqual(mockSession);
      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Session',
          description: 'Test description',
          language: 'typescript',
          visibility: 'PUBLIC',
          status: 'ACTIVE',
          owner_id: 'user-123',
          participants: {
            create: {
              user_id: 'user-123',
              role: 'OWNER',
            },
          },
        },
        include: expect.any(Object),
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should create session without description', async () => {
      const mockSession = {
        ...createMockSession({ description: null }),
        owner: createMockUser(),
        participants: [],
      };

      mockPrisma.session.create.mockResolvedValue(mockSession);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await sessionService.createSession({
        name: 'Test Session',
        language: 'javascript' as ProgrammingLanguage,
        visibility: 'PRIVATE' as SessionVisibility,
        ownerId: 'user-123',
      });

      expect(result.description).toBeNull();
    });
  });

  describe('getSession', () => {
    it('should return session by ID', async () => {
      const mockSession = {
        ...createMockSession(),
        owner: createMockUser(),
        participants: [],
        files: [],
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      const result = await sessionService.getSession('session-123');

      expect(result).toEqual(mockSession);
      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(sessionService.getSession('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when session is deleted', async () => {
      const deletedSession = {
        ...createMockSession({ deleted_at: new Date() }),
        owner: createMockUser(),
        participants: [],
        files: [],
      };

      mockPrisma.session.findUnique.mockResolvedValue(deletedSession);

      await expect(sessionService.getSession('session-123')).rejects.toThrow(NotFoundError);
    });

    it('should allow owner access to private session', async () => {
      const privateSession = {
        ...createMockSession({ visibility: 'PRIVATE' as SessionVisibility }),
        owner: createMockUser(),
        participants: [],
        files: [],
      };

      mockPrisma.session.findUnique.mockResolvedValue(privateSession);

      const result = await sessionService.getSession('session-123', 'user-123');

      expect(result).toEqual(privateSession);
    });

    it('should allow participant access to private session', async () => {
      const privateSession = {
        ...createMockSession({ visibility: 'PRIVATE' as SessionVisibility, owner_id: 'other-user' }),
        owner: createMockUser({ id: 'other-user' }),
        participants: [
          {
            ...createMockParticipant({ user_id: 'user-123' }),
            user: createMockUser(),
          },
        ],
        files: [],
      };

      mockPrisma.session.findUnique.mockResolvedValue(privateSession);

      const result = await sessionService.getSession('session-123', 'user-123');

      expect(result).toEqual(privateSession);
    });

    it('should throw AuthorizationError when user lacks access to private session', async () => {
      const privateSession = {
        ...createMockSession({ visibility: 'PRIVATE' as SessionVisibility, owner_id: 'other-user' }),
        owner: createMockUser({ id: 'other-user' }),
        participants: [],
        files: [],
      };

      mockPrisma.session.findUnique.mockResolvedValue(privateSession);

      await expect(sessionService.getSession('session-123', 'unauthorized-user')).rejects.toThrow(
        AuthorizationError
      );
    });
  });

  describe('listSessions', () => {
    it('should list sessions with pagination', async () => {
      const mockSessions = [
        {
          ...createMockSession(),
          owner: createMockUser(),
          participants: [],
        },
      ];

      mockPrisma.session.findMany.mockResolvedValue(mockSessions);
      mockPrisma.session.count.mockResolvedValue(1);

      const result = await sessionService.listSessions({ limit: 20, offset: 0 });

      expect(result).toEqual({
        sessions: mockSessions,
        total: 1,
        limit: 20,
        offset: 0,
      });
    });

    it('should filter by visibility', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      await sessionService.listSessions({ visibility: 'PUBLIC' as SessionVisibility });

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visibility: 'PUBLIC',
          }),
        })
      );
    });

    it('should filter by language', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      await sessionService.listSessions({ language: 'python' as ProgrammingLanguage });

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            language: 'python',
          }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      await sessionService.listSessions({ status: 'ACTIVE' });

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should show user sessions and public sessions when userId provided', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      await sessionService.listSessions({ userId: 'user-123' });

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { visibility: 'PUBLIC' },
              { owner_id: 'user-123' },
            ]),
          }),
        })
      );
    });

    it('should only show public sessions for anonymous users', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      await sessionService.listSessions({});

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visibility: 'PUBLIC',
          }),
        })
      );
    });
  });

  describe('updateSession', () => {
    it('should update session settings', async () => {
      const mockSession = createMockSession();
      const updatedSession = {
        ...mockSession,
        name: 'Updated Name',
        owner: createMockUser(),
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.session.update.mockResolvedValue(updatedSession);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await sessionService.updateSession('session-123', 'user-123', {
        name: 'Updated Name',
      });

      expect(result).toEqual(updatedSession);
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: expect.objectContaining({
          name: 'Updated Name',
        }),
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.updateSession('nonexistent', 'user-123', { name: 'Updated' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when session is deleted', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession({ deleted_at: new Date() }));

      await expect(
        sessionService.updateSession('session-123', 'user-123', { name: 'Updated' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user is not owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession({ owner_id: 'other-user' }));

      await expect(
        sessionService.updateSession('session-123', 'user-123', { name: 'Updated' })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('deleteSession', () => {
    it('should soft delete session', async () => {
      const mockSession = createMockSession();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.session.update.mockResolvedValue({
        ...mockSession,
        deleted_at: new Date(),
        deleted_by: 'user-123',
      });
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await sessionService.deleteSession('session-123', 'user-123');

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: {
          deleted_at: expect.any(Date),
          deleted_by: 'user-123',
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(sessionService.deleteSession('nonexistent', 'user-123')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw AuthorizationError when user is not owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession({ owner_id: 'other-user' }));

      await expect(sessionService.deleteSession('session-123', 'user-123')).rejects.toThrow(
        AuthorizationError
      );
    });
  });

  describe('addParticipant', () => {
    it('should add new participant to session', async () => {
      const mockSession = createMockSession();
      const mockParticipant = {
        ...createMockParticipant({ user_id: 'new-user', role: 'EDITOR' as ParticipantRole }),
        user: createMockUser({ id: 'new-user' }),
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.participant.create.mockResolvedValue(mockParticipant);
      mockPrisma.session.update.mockResolvedValue(mockSession);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await sessionService.addParticipant({
        sessionId: 'session-123',
        userId: 'new-user',
        role: 'EDITOR' as ParticipantRole,
      });

      expect(result).toEqual(mockParticipant);
      expect(mockPrisma.participant.create).toHaveBeenCalledWith({
        data: {
          session_id: 'session-123',
          user_id: 'new-user',
          role: 'EDITOR',
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.addParticipant({
          sessionId: 'nonexistent',
          userId: 'user-123',
          role: 'EDITOR' as ParticipantRole,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when user is already participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession());
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());

      await expect(
        sessionService.addParticipant({
          sessionId: 'session-123',
          userId: 'user-123',
          role: 'EDITOR' as ParticipantRole,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('removeParticipant', () => {
    it('should mark participant as left', async () => {
      const mockParticipant = createMockParticipant();

      mockPrisma.participant.findFirst.mockResolvedValue(mockParticipant);
      mockPrisma.participant.update.mockResolvedValue({
        ...mockParticipant,
        left_at: new Date(),
      });
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await sessionService.removeParticipant('session-123', 'user-123', 'admin-user');

      expect(mockPrisma.participant.update).toHaveBeenCalledWith({
        where: { id: 'participant-123' },
        data: { left_at: expect.any(Date) },
      });
    });

    it('should throw NotFoundError when participant does not exist', async () => {
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.removeParticipant('session-123', 'nonexistent', 'admin-user')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateCursorPosition', () => {
    it('should update cursor position for participant', async () => {
      mockPrisma.participant.updateMany.mockResolvedValue({ count: 1 });

      await sessionService.updateCursorPosition('session-123', 'user-123', 10, 5);

      expect(mockPrisma.participant.updateMany).toHaveBeenCalledWith({
        where: {
          session_id: 'session-123',
          user_id: 'user-123',
          left_at: null,
        },
        data: {
          cursor_line: 10,
          cursor_column: 5,
          last_seen: expect.any(Date),
        },
      });
    });
  });

  describe('getSessionContent', () => {
    it('should return session description as content', async () => {
      const mockSession = {
        ...createMockSession({ description: 'Session content here' }),
        owner: createMockUser(),
        participants: [],
        files: [],
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      const result = await sessionService.getSessionContent('session-123', 'user-123');

      expect(result).toBe('Session content here');
    });

    it('should return empty string when no description', async () => {
      const mockSession = {
        ...createMockSession({ description: null }),
        owner: createMockUser(),
        participants: [],
        files: [],
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      const result = await sessionService.getSessionContent('session-123', 'user-123');

      expect(result).toBe('');
    });
  });

  describe('updateSessionContent', () => {
    it('should update session activity', async () => {
      const mockSession = createMockSession();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.session.update.mockResolvedValue(mockSession);

      await sessionService.updateSessionContent('session-123', 'user-123', 'new content');

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: { last_activity: expect.any(Date) },
      });
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.updateSessionContent('nonexistent', 'user-123', 'content')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user is not participant or owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession({ owner_id: 'other-user' }));
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.updateSessionContent('session-123', 'user-123', 'content')
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('getSessionFiles', () => {
    it('should return list of files', async () => {
      const mockFiles = [
        createMockFile({ name: 'file1.ts', path: 'file1.ts' }),
        createMockFile({ id: 'file-456', name: 'file2.ts', path: 'file2.ts' }),
      ];

      const mockSession = {
        ...createMockSession(),
        owner: createMockUser(),
        participants: [],
        files: mockFiles,
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.sessionFile.findMany.mockResolvedValue(mockFiles);

      const result = await sessionService.getSessionFiles('session-123', 'user-123');

      expect(result).toEqual(mockFiles);
      expect(mockPrisma.sessionFile.findMany).toHaveBeenCalledWith({
        where: {
          session_id: 'session-123',
          deleted_at: null,
        },
        select: expect.any(Object),
        orderBy: { path: 'asc' },
      });
    });
  });

  describe('createFile', () => {
    it('should create new file in session', async () => {
      const mockSession = createMockSession();
      const mockFile = createMockFile();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.sessionFile.create.mockResolvedValue(mockFile);

      const result = await sessionService.createFile('session-123', 'user-123', 'test.ts', 'file');

      expect(result).toEqual(mockFile);
      expect(mockPrisma.sessionFile.create).toHaveBeenCalledWith({
        data: {
          session_id: 'session-123',
          name: 'test.ts',
          type: 'file',
          path: 'test.ts',
          content: '',
        },
        select: expect.any(Object),
      });
    });

    it('should create folder with null content', async () => {
      const mockSession = createMockSession();
      const mockFolder = createMockFile({ type: 'folder', content: null });

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.sessionFile.create.mockResolvedValue(mockFolder);

      await sessionService.createFile('session-123', 'user-123', 'src', 'folder');

      expect(mockPrisma.sessionFile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'folder',
          content: null,
        }),
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.createFile('nonexistent', 'user-123', 'test.ts', 'file')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user lacks permission', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession({ owner_id: 'other-user' }));
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.createFile('session-123', 'user-123', 'test.ts', 'file')
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('deleteFile', () => {
    it('should soft delete file', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession());
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.sessionFile.update.mockResolvedValue(createMockFile({ deleted_at: new Date() }));

      await sessionService.deleteFile('session-123', 'user-123', 'file-123');

      expect(mockPrisma.sessionFile.update).toHaveBeenCalledWith({
        where: { id: 'file-123' },
        data: { deleted_at: expect.any(Date) },
      });
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.deleteFile('nonexistent', 'user-123', 'file-123')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user lacks permission', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession({ owner_id: 'other-user' }));
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.deleteFile('session-123', 'user-123', 'file-123')
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('getFileContent', () => {
    it('should return file content', async () => {
      const mockSession = createMockSession();
      const mockFile = createMockFile({ content: 'file content here' });

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.sessionFile.findFirst.mockResolvedValue(mockFile);

      const result = await sessionService.getFileContent('session-123', 'user-123', 'test.ts');

      expect(result).toBe('file content here');
    });

    it('should return empty string when file not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession());
      mockPrisma.sessionFile.findFirst.mockResolvedValue(null);

      const result = await sessionService.getFileContent('session-123', 'user-123', 'nonexistent.ts');

      expect(result).toBe('');
    });

    it('should allow access to public session files without being participant', async () => {
      const publicSession = createMockSession({ visibility: 'PUBLIC' as SessionVisibility });
      const mockFile = createMockFile({ content: 'public content' });

      mockPrisma.session.findUnique.mockResolvedValue(publicSession);
      mockPrisma.sessionFile.findFirst.mockResolvedValue(mockFile);

      const result = await sessionService.getFileContent('session-123', 'other-user', 'test.ts');

      expect(result).toBe('public content');
    });

    it('should throw AuthorizationError for non-public session without access', async () => {
      const privateSession = createMockSession({
        visibility: 'PRIVATE' as SessionVisibility,
        owner_id: 'other-user',
      });

      mockPrisma.session.findUnique.mockResolvedValue(privateSession);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.getFileContent('session-123', 'user-123', 'test.ts')
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('updateFileContent', () => {
    it('should upsert file content', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession());
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.sessionFile.upsert.mockResolvedValue(createMockFile());

      await sessionService.updateFileContent('session-123', 'user-123', 'test.ts', 'new content');

      expect(mockPrisma.sessionFile.upsert).toHaveBeenCalledWith({
        where: {
          session_id_path: {
            session_id: 'session-123',
            path: 'test.ts',
          },
        },
        update: {
          content: 'new content',
          updated_at: expect.any(Date),
        },
        create: {
          session_id: 'session-123',
          path: 'test.ts',
          name: 'test.ts',
          type: 'file',
          content: 'new content',
        },
      });
    });

    it('should extract filename from path', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession());
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.sessionFile.upsert.mockResolvedValue(createMockFile());

      await sessionService.updateFileContent('session-123', 'user-123', 'src/utils/test.ts', 'content');

      expect(mockPrisma.sessionFile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            name: 'test.ts',
            path: 'src/utils/test.ts',
          }),
        })
      );
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.updateFileContent('nonexistent', 'user-123', 'test.ts', 'content')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user lacks permission', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession({ owner_id: 'other-user' }));
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.updateFileContent('session-123', 'user-123', 'test.ts', 'content')
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('searchFiles', () => {
    it('should search across session files', async () => {
      const mockSession = createMockSession();
      const mockFiles = [
        createMockFile({ path: 'test1.ts', content: 'const foo = "hello";\nconst bar = "world";' }),
        createMockFile({ path: 'test2.ts', content: 'function hello() { return "hello"; }' }),
      ];

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.sessionFile.findMany.mockResolvedValue(mockFiles);

      const result = await sessionService.searchFiles('session-123', 'user-123', 'hello');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('filePath');
      expect(result[0]).toHaveProperty('line');
      expect(result[0]).toHaveProperty('column');
    });

    it('should support regex search', async () => {
      const mockFiles = [createMockFile({ content: 'const test123 = "value";' })];

      mockPrisma.session.findUnique.mockResolvedValue(createMockSession());
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.sessionFile.findMany.mockResolvedValue(mockFiles);

      const result = await sessionService.searchFiles('session-123', 'user-123', 'test\\d+', {
        regex: true,
      });

      expect(result.length).toBe(1);
    });

    it('should support case-sensitive search', async () => {
      const mockFiles = [createMockFile({ content: 'const Hello = "HELLO";' })];

      mockPrisma.session.findUnique.mockResolvedValue(createMockSession());
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.sessionFile.findMany.mockResolvedValue(mockFiles);

      const result = await sessionService.searchFiles('session-123', 'user-123', 'Hello', {
        caseSensitive: true,
      });

      expect(result.length).toBe(1);
    });

    it('should support whole word search', async () => {
      const mockFiles = [createMockFile({ content: 'test testing tester' })];

      mockPrisma.session.findUnique.mockResolvedValue(createMockSession());
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.sessionFile.findMany.mockResolvedValue(mockFiles);

      const result = await sessionService.searchFiles('session-123', 'user-123', 'test', {
        wholeWord: true,
      });

      expect(result.length).toBe(1);
    });

    it('should throw ValidationError for invalid regex', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(createMockSession());
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.sessionFile.findMany.mockResolvedValue([]);

      await expect(
        sessionService.searchFiles('session-123', 'user-123', '[invalid', { regex: true })
      ).rejects.toThrow(ValidationError);
    });

    it('should skip files with null content', async () => {
      const mockFiles = [createMockFile({ content: null })];

      mockPrisma.session.findUnique.mockResolvedValue(createMockSession());
      mockPrisma.participant.findFirst.mockResolvedValue(createMockParticipant());
      mockPrisma.sessionFile.findMany.mockResolvedValue(mockFiles);

      const result = await sessionService.searchFiles('session-123', 'user-123', 'test');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.searchFiles('nonexistent', 'user-123', 'test')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError for private session without access', async () => {
      const privateSession = createMockSession({
        visibility: 'PRIVATE' as SessionVisibility,
        owner_id: 'other-user',
      });

      mockPrisma.session.findUnique.mockResolvedValue(privateSession);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.searchFiles('session-123', 'user-123', 'test')
      ).rejects.toThrow(AuthorizationError);
    });
  });
});
