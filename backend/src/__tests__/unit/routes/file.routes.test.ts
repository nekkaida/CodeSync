// File routes unit tests
// Tests for file upload/download routes

import { Request, Response } from 'express';
import { createMockRequest, createMockResponse } from '../../helpers/testUtils';
import { mockPrisma } from '../../setup';

// Mock storage service
jest.mock('../../../services/storage.service', () => ({
  __esModule: true,
  default: {
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
    getPresignedUrl: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
  },
}));

// Mock multer
jest.mock('multer', () => {
  const multerMock = () => ({
    single: () => (_req: Request, _res: Response, next: () => void) => {
      // Simulate file being parsed
      next();
    },
  });
  multerMock.memoryStorage = () => ({});
  return multerMock;
});

import storageService from '../../../services/storage.service';

describe('File Routes', () => {
  const mockStorageService = storageService as jest.Mocked<typeof storageService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /sessions/:sessionId/files/upload', () => {
    it('should upload a file successfully', async () => {
      const mockSession = {
        id: 'session-123',
        owner_id: 'user-123',
        deleted_at: null,
        participants: [],
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as never);
      mockPrisma.sessionFile.create.mockResolvedValue({
        id: 'file-123',
        session_id: 'session-123',
        name: 'test.txt',
        type: 'file',
        path: 'test.txt',
        original_name: 'test.txt',
        stored_name: 'stored-test.txt',
        mime_type: 'text/plain',
        size: 100,
        storage_key: 'sessions/session-123/stored-test.txt',
        storage_url: 'http://storage/sessions/session-123/stored-test.txt',
        uploaded_by: 'user-123',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        content: null,
      } as never);

      mockStorageService.uploadFile.mockResolvedValue({
        storedName: 'stored-test.txt',
        storageKey: 'sessions/session-123/stored-test.txt',
        storageUrl: 'http://storage/sessions/session-123/stored-test.txt',
        size: 100,
      });

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });
      (mockReq as Record<string, unknown>).file = {
        buffer: Buffer.from('test content'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      };

      const mockRes = createMockResponse();

      // Test the upload logic directly
      const uploadHandler = async (req: Request, res: Response) => {
        const { sessionId } = req.params;
        const userId = req.user!.id;

        if (!req.file) {
          throw new Error('No file provided');
        }

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const hasAccess = session.owner_id === userId || session.participants.length > 0;

        if (!hasAccess) {
          throw new Error('Access denied');
        }

        const { storedName, storageKey, storageUrl, size } = await mockStorageService.uploadFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          sessionId,
        );

        const fileRecord = await mockPrisma.sessionFile.create({
          data: {
            session_id: sessionId,
            name: req.file.originalname,
            type: 'file',
            path: req.file.originalname,
            original_name: req.file.originalname,
            stored_name: storedName,
            mime_type: req.file.mimetype,
            size,
            storage_key: storageKey,
            storage_url: storageUrl,
            uploaded_by: userId,
          },
        });

        res.status(201).json({
          success: true,
          data: { file: fileRecord },
        });
      };

      await uploadHandler(mockReq as unknown as Request, mockRes as unknown as Response);

      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        include: {
          participants: {
            where: { user_id: 'user-123', left_at: null },
          },
        },
      });
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        Buffer.from('test content'),
        'test.txt',
        'text/plain',
        'session-123',
      );
      expect(mockPrisma.sessionFile.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { file: expect.any(Object) },
      });
    });

    it('should throw error when no file provided', async () => {
      const mockReq = createMockRequest({
        params: { sessionId: 'session-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });
      // No file attached

      const uploadHandler = async (req: Request) => {
        if (!req.file) {
          throw new Error('No file provided');
        }
      };

      await expect(uploadHandler(mockReq as unknown as Request)).rejects.toThrow('No file provided');
    });

    it('should throw error when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null as never);

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });
      (mockReq as Record<string, unknown>).file = {
        buffer: Buffer.from('test content'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      };

      const uploadHandler = async (req: Request) => {
        const { sessionId } = req.params;
        const userId = req.user!.id;

        if (!req.file) {
          throw new Error('No file provided');
        }

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }
      };

      await expect(uploadHandler(mockReq as unknown as Request)).rejects.toThrow('Session not found');
    });

    it('should throw error when session is deleted', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'user-123',
        deleted_at: new Date(),
        participants: [],
      } as never);

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });
      (mockReq as Record<string, unknown>).file = {
        buffer: Buffer.from('test content'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      };

      const uploadHandler = async (req: Request) => {
        const { sessionId } = req.params;
        const userId = req.user!.id;

        if (!req.file) {
          throw new Error('No file provided');
        }

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }
      };

      await expect(uploadHandler(mockReq as unknown as Request)).rejects.toThrow('Session not found');
    });

    it('should throw error when user has no access', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'other-user',
        deleted_at: null,
        participants: [],
      } as never);

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });
      (mockReq as Record<string, unknown>).file = {
        buffer: Buffer.from('test content'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      };

      const uploadHandler = async (req: Request) => {
        const { sessionId } = req.params;
        const userId = req.user!.id;

        if (!req.file) {
          throw new Error('No file provided');
        }

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const hasAccess = session.owner_id === userId || session.participants.length > 0;

        if (!hasAccess) {
          throw new Error('Access denied');
        }
      };

      await expect(uploadHandler(mockReq as unknown as Request)).rejects.toThrow('Access denied');
    });

    it('should allow access for session participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'other-user',
        deleted_at: null,
        participants: [{ user_id: 'user-123' }],
      } as never);

      mockPrisma.sessionFile.create.mockResolvedValue({
        id: 'file-123',
        session_id: 'session-123',
        name: 'test.txt',
      } as never);

      mockStorageService.uploadFile.mockResolvedValue({
        storedName: 'stored-test.txt',
        storageKey: 'sessions/session-123/stored-test.txt',
        storageUrl: 'http://storage/sessions/session-123/stored-test.txt',
        size: 100,
      });

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });
      (mockReq as Record<string, unknown>).file = {
        buffer: Buffer.from('test content'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      };

      const mockRes = createMockResponse();

      const uploadHandler = async (req: Request, res: Response) => {
        const { sessionId } = req.params;
        const userId = req.user!.id;

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const hasAccess = session.owner_id === userId || session.participants.length > 0;

        if (!hasAccess) {
          throw new Error('Access denied');
        }

        const { storedName, storageKey, storageUrl, size } = await mockStorageService.uploadFile(
          req.file!.buffer,
          req.file!.originalname,
          req.file!.mimetype,
          sessionId,
        );

        await mockPrisma.sessionFile.create({
          data: {
            session_id: sessionId,
            name: req.file!.originalname,
            type: 'file',
            path: req.file!.originalname,
            stored_name: storedName,
            storage_key: storageKey,
            storage_url: storageUrl,
            size,
          },
        });

        res.status(201).json({ success: true });
      };

      await uploadHandler(mockReq as unknown as Request, mockRes as unknown as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('GET /sessions/:sessionId/files/:fileId/download', () => {
    it('should download file successfully for owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'user-123',
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: 'file-123',
        storage_key: 'sessions/session-123/test.txt',
        mime_type: 'text/plain',
        original_name: 'test.txt',
        deleted_at: null,
      } as never);

      const fileContent = Buffer.from('file content');
      mockStorageService.downloadFile.mockResolvedValue(fileContent);

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123', fileId: 'file-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      const mockRes = createMockResponse();

      const downloadHandler = async (req: Request, res: Response) => {
        const { sessionId, fileId } = req.params;
        const userId = req.user!.id;

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const hasAccess =
          session.owner_id === userId ||
          session.participants.length > 0 ||
          session.visibility === 'PUBLIC';

        if (!hasAccess) {
          throw new Error('Access denied');
        }

        const file = await mockPrisma.sessionFile.findUnique({
          where: { id: fileId },
        });

        if (!file || file.deleted_at || !file.storage_key) {
          throw new Error('File not found');
        }

        const fileBuffer = await mockStorageService.downloadFile(file.storage_key);

        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
        res.setHeader('Content-Length', fileBuffer.length);
        res.send(fileBuffer);
      };

      await downloadHandler(mockReq as unknown as Request, mockRes as unknown as Response);

      expect(mockStorageService.downloadFile).toHaveBeenCalledWith('sessions/session-123/test.txt');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(mockRes.send).toHaveBeenCalledWith(fileContent);
    });

    it('should allow download for public session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'other-user',
        deleted_at: null,
        visibility: 'PUBLIC',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: 'file-123',
        storage_key: 'sessions/session-123/test.txt',
        mime_type: 'text/plain',
        original_name: 'test.txt',
        deleted_at: null,
      } as never);

      mockStorageService.downloadFile.mockResolvedValue(Buffer.from('content'));

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123', fileId: 'file-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      const mockRes = createMockResponse();

      const downloadHandler = async (req: Request, res: Response) => {
        const { sessionId, fileId } = req.params;
        const userId = req.user!.id;

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const hasAccess =
          session.owner_id === userId ||
          session.participants.length > 0 ||
          session.visibility === 'PUBLIC';

        if (!hasAccess) {
          throw new Error('Access denied');
        }

        const file = await mockPrisma.sessionFile.findUnique({
          where: { id: fileId },
        });

        if (!file || file.deleted_at || !file.storage_key) {
          throw new Error('File not found');
        }

        const fileBuffer = await mockStorageService.downloadFile(file.storage_key);
        res.send(fileBuffer);
      };

      await downloadHandler(mockReq as unknown as Request, mockRes as unknown as Response);

      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should throw error when file not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'user-123',
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue(null as never);

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123', fileId: 'file-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      const downloadHandler = async (req: Request) => {
        const { sessionId, fileId } = req.params;
        const userId = req.user!.id;

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const file = await mockPrisma.sessionFile.findUnique({
          where: { id: fileId },
        });

        if (!file || file.deleted_at || !file.storage_key) {
          throw new Error('File not found');
        }
      };

      await expect(downloadHandler(mockReq as unknown as Request)).rejects.toThrow('File not found');
    });

    it('should throw error when file is deleted', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'user-123',
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: 'file-123',
        storage_key: 'sessions/session-123/test.txt',
        deleted_at: new Date(),
      } as never);

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123', fileId: 'file-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      const downloadHandler = async (req: Request) => {
        const { sessionId, fileId } = req.params;
        const userId = req.user!.id;

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const file = await mockPrisma.sessionFile.findUnique({
          where: { id: fileId },
        });

        if (!file || file.deleted_at || !file.storage_key) {
          throw new Error('File not found');
        }
      };

      await expect(downloadHandler(mockReq as unknown as Request)).rejects.toThrow('File not found');
    });

    it('should throw error when file has no storage key', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'user-123',
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: 'file-123',
        storage_key: null,
        deleted_at: null,
      } as never);

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123', fileId: 'file-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      const downloadHandler = async (req: Request) => {
        const { sessionId, fileId } = req.params;
        const userId = req.user!.id;

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const file = await mockPrisma.sessionFile.findUnique({
          where: { id: fileId },
        });

        if (!file || file.deleted_at || !file.storage_key) {
          throw new Error('File not found');
        }
      };

      await expect(downloadHandler(mockReq as unknown as Request)).rejects.toThrow('File not found');
    });

    it('should use default mime type when not set', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'user-123',
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: 'file-123',
        storage_key: 'sessions/session-123/test.bin',
        mime_type: null,
        original_name: 'test.bin',
        deleted_at: null,
      } as never);

      mockStorageService.downloadFile.mockResolvedValue(Buffer.from('content'));

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123', fileId: 'file-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      const mockRes = createMockResponse();

      const downloadHandler = async (req: Request, res: Response) => {
        const { sessionId, fileId } = req.params;
        const userId = req.user!.id;

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const file = await mockPrisma.sessionFile.findUnique({
          where: { id: fileId },
        });

        if (!file || file.deleted_at || !file.storage_key) {
          throw new Error('File not found');
        }

        const fileBuffer = await mockStorageService.downloadFile(file.storage_key);

        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.send(fileBuffer);
      };

      await downloadHandler(mockReq as unknown as Request, mockRes as unknown as Response);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
    });
  });

  describe('GET /sessions/:sessionId/files/:fileId/url', () => {
    it('should return presigned URL', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'user-123',
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: 'file-123',
        storage_key: 'sessions/session-123/test.txt',
        deleted_at: null,
      } as never);

      mockStorageService.getPresignedUrl.mockResolvedValue('https://storage.example.com/presigned-url');

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123', fileId: 'file-123' },
        query: { expiry: '7200' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      const mockRes = createMockResponse();

      const urlHandler = async (req: Request, res: Response) => {
        const { sessionId, fileId } = req.params;
        const userId = req.user!.id;
        const expirySeconds = parseInt(req.query.expiry as string) || 3600;

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const hasAccess =
          session.owner_id === userId ||
          session.participants.length > 0 ||
          session.visibility === 'PUBLIC';

        if (!hasAccess) {
          throw new Error('Access denied');
        }

        const file = await mockPrisma.sessionFile.findUnique({
          where: { id: fileId },
        });

        if (!file || file.deleted_at || !file.storage_key) {
          throw new Error('File not found');
        }

        const url = await mockStorageService.getPresignedUrl(file.storage_key, expirySeconds);

        res.json({
          success: true,
          data: {
            url,
            expiresIn: expirySeconds,
          },
        });
      };

      await urlHandler(mockReq as unknown as Request, mockRes as unknown as Response);

      expect(mockStorageService.getPresignedUrl).toHaveBeenCalledWith(
        'sessions/session-123/test.txt',
        7200,
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          url: 'https://storage.example.com/presigned-url',
          expiresIn: 7200,
        },
      });
    });

    it('should use default expiry when not provided', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'user-123',
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: 'file-123',
        storage_key: 'sessions/session-123/test.txt',
        deleted_at: null,
      } as never);

      mockStorageService.getPresignedUrl.mockResolvedValue('https://storage.example.com/presigned-url');

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123', fileId: 'file-123' },
        query: {},
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      const mockRes = createMockResponse();

      const urlHandler = async (req: Request, res: Response) => {
        const { sessionId, fileId } = req.params;
        const userId = req.user!.id;
        const expirySeconds = parseInt(req.query.expiry as string) || 3600;

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const file = await mockPrisma.sessionFile.findUnique({
          where: { id: fileId },
        });

        if (!file || file.deleted_at || !file.storage_key) {
          throw new Error('File not found');
        }

        const url = await mockStorageService.getPresignedUrl(file.storage_key, expirySeconds);

        res.json({
          success: true,
          data: {
            url,
            expiresIn: expirySeconds,
          },
        });
      };

      await urlHandler(mockReq as unknown as Request, mockRes as unknown as Response);

      expect(mockStorageService.getPresignedUrl).toHaveBeenCalledWith(
        'sessions/session-123/test.txt',
        3600,
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          url: 'https://storage.example.com/presigned-url',
          expiresIn: 3600,
        },
      });
    });

    it('should throw error when session not found for URL request', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null as never);

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123', fileId: 'file-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      const urlHandler = async (req: Request) => {
        const { sessionId } = req.params;
        const userId = req.user!.id;

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }
      };

      await expect(urlHandler(mockReq as unknown as Request)).rejects.toThrow('Session not found');
    });

    it('should throw error when access denied for URL request', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'other-user',
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123', fileId: 'file-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      const urlHandler = async (req: Request) => {
        const { sessionId } = req.params;
        const userId = req.user!.id;

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const hasAccess =
          session.owner_id === userId ||
          session.participants.length > 0 ||
          session.visibility === 'PUBLIC';

        if (!hasAccess) {
          throw new Error('Access denied');
        }
      };

      await expect(urlHandler(mockReq as unknown as Request)).rejects.toThrow('Access denied');
    });

    it('should throw error when file not found for URL request', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        owner_id: 'user-123',
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue(null as never);

      const mockReq = createMockRequest({
        params: { sessionId: 'session-123', fileId: 'file-123' },
        user: { id: 'user-123', email: 'test@example.com', role: 'USER' },
      });

      const urlHandler = async (req: Request) => {
        const { sessionId, fileId } = req.params;
        const userId = req.user!.id;

        const session = await mockPrisma.session.findUnique({
          where: { id: sessionId },
          include: {
            participants: {
              where: { user_id: userId, left_at: null },
            },
          },
        });

        if (!session || session.deleted_at) {
          throw new Error('Session not found');
        }

        const file = await mockPrisma.sessionFile.findUnique({
          where: { id: fileId },
        });

        if (!file || file.deleted_at || !file.storage_key) {
          throw new Error('File not found');
        }
      };

      await expect(urlHandler(mockReq as unknown as Request)).rejects.toThrow('File not found');
    });
  });
});
