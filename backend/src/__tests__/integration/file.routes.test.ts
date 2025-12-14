// File routes integration tests
// Tests file upload/download API endpoints

import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { mockPrisma } from '../setup';
import bcrypt from 'bcryptjs';

// Mock storage service
jest.mock('../../services/storage.service', () => ({
  __esModule: true,
  default: {
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
    getPresignedUrl: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
  },
}));

import storageService from '../../services/storage.service';

const app = createTestApp();
const mockStorageService = storageService as jest.Mocked<typeof storageService>;

// Valid CUID-like IDs for testing
const USER_ID = 'cluser00000000000001';
const SESSION_ID = 'clsession00000000001';
const FILE_ID = 'clfile000000000000001';

// Helper to extract cookies as string array
const getCookies = (response: request.Response): string[] => {
  const cookies = response.headers['set-cookie'];
  if (!cookies) return [];
  if (Array.isArray(cookies)) return cookies;
  return [cookies];
};

// Helper to get CSRF token and cookies for requests
async function getAuthHeaders() {
  const csrfResponse = await request(app).get('/api/auth/csrf');
  const cookies = getCookies(csrfResponse);
  const csrfToken = csrfResponse.body.data?.token || '';
  return { cookies, csrfToken };
}

// Helper to login and get authenticated cookies
async function loginUser(
  email: string = 'test@example.com',
  password: string = 'Password123',
  userId: string = USER_ID,
) {
  const hashedPassword = await bcrypt.hash(password, 12);
  const mockUser = {
    id: userId,
    email,
    name: 'Test User',
    role: 'USER',
    password: hashedPassword,
    deleted_at: null,
    deleted_by: null,
    created_at: new Date(),
    updated_at: new Date(),
    ai_cost_limit: 10.0,
  };

  mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
  mockPrisma.auditLog.create.mockResolvedValue({} as any);

  const { cookies, csrfToken } = await getAuthHeaders();

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .set('Cookie', cookies)
    .set('x-csrf-token', csrfToken)
    .send({ email, password });

  if (loginResponse.status !== 200) {
    throw new Error(`Login failed with status ${loginResponse.status}`);
  }

  const authCookies = getCookies(loginResponse);
  const allCookies = [...cookies, ...authCookies.filter((c) => c.includes('token='))];

  mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);
  mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

  return { cookies: allCookies, csrfToken, mockUser };
}

describe('File Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/sessions/:sessionId/files/upload', () => {
    it('should upload a file successfully', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      const mockSession = {
        id: SESSION_ID,
        owner_id: mockUser.id,
        deleted_at: null,
        participants: [],
      };

      const mockFileRecord = {
        id: FILE_ID,
        session_id: SESSION_ID,
        name: 'test.txt',
        type: 'file',
        path: 'test.txt',
        original_name: 'test.txt',
        stored_name: 'stored-test.txt',
        mime_type: 'text/plain',
        size: 12,
        storage_key: `sessions/${SESSION_ID}/stored-test.txt`,
        storage_url: `http://storage/sessions/${SESSION_ID}/stored-test.txt`,
        uploaded_by: mockUser.id,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        content: null,
        yjs_state: null,
        is_binary: false,
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as never);
      mockPrisma.sessionFile.create.mockResolvedValue(mockFileRecord as never);

      mockStorageService.uploadFile.mockResolvedValue({
        storedName: 'stored-test.txt',
        storageKey: `sessions/${SESSION_ID}/stored-test.txt`,
        storageUrl: `http://storage/sessions/${SESSION_ID}/stored-test.txt`,
        size: 12,
      });

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/files/upload`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .attach('file', Buffer.from('test content'), 'test.txt');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.file).toBeDefined();
    });

    it('should return 400 when no file provided', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/files/upload`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/files/upload`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .attach('file', Buffer.from('test content'), 'test.txt');

      expect(response.status).toBe(401);
    });

    it('should return 404 when session not found', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/files/upload`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .attach('file', Buffer.from('test content'), 'test.txt');

      expect(response.status).toBe(404);
    });

    it('should return 400 when user has no access', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: 'other-user',
        deleted_at: null,
        participants: [],
      } as never);

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/files/upload`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .attach('file', Buffer.from('test content'), 'test.txt');

      expect(response.status).toBe(400);
    });

    it('should allow upload for session participant', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: 'other-user',
        deleted_at: null,
        participants: [{ user_id: mockUser.id }],
      } as never);
      mockPrisma.sessionFile.create.mockResolvedValue({
        id: FILE_ID,
        session_id: SESSION_ID,
        name: 'test.txt',
      } as never);

      mockStorageService.uploadFile.mockResolvedValue({
        storedName: 'stored-test.txt',
        storageKey: `sessions/${SESSION_ID}/stored-test.txt`,
        storageUrl: `http://storage/sessions/${SESSION_ID}/stored-test.txt`,
        size: 12,
      });

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/files/upload`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .attach('file', Buffer.from('test content'), 'test.txt');

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/sessions/:sessionId/files/:fileId/download', () => {
    it('should download file successfully for owner', async () => {
      const { cookies, mockUser } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: mockUser.id,
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: FILE_ID,
        storage_key: `sessions/${SESSION_ID}/test.txt`,
        mime_type: 'text/plain',
        original_name: 'test.txt',
        deleted_at: null,
      } as never);

      const fileContent = Buffer.from('file content');
      mockStorageService.downloadFile.mockResolvedValue(fileContent);

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/download`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/plain');
      expect(response.headers['content-disposition']).toBe('attachment; filename="test.txt"');
    });

    it('should allow download for public session', async () => {
      const { cookies } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: 'other-user',
        deleted_at: null,
        visibility: 'PUBLIC',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: FILE_ID,
        storage_key: `sessions/${SESSION_ID}/test.txt`,
        mime_type: 'text/plain',
        original_name: 'test.txt',
        deleted_at: null,
      } as never);

      mockStorageService.downloadFile.mockResolvedValue(Buffer.from('content'));

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/download`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(
        `/api/sessions/${SESSION_ID}/files/${FILE_ID}/download`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 404 when session not found', async () => {
      const { cookies } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/download`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
    });

    it('should return 404 when file not found', async () => {
      const { cookies, mockUser } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: mockUser.id,
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/download`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
    });

    it('should return 404 when file is deleted', async () => {
      const { cookies, mockUser } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: mockUser.id,
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: FILE_ID,
        storage_key: `sessions/${SESSION_ID}/test.txt`,
        deleted_at: new Date(),
      } as never);

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/download`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
    });

    it('should use default mime type when not set', async () => {
      const { cookies, mockUser } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: mockUser.id,
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: FILE_ID,
        storage_key: `sessions/${SESSION_ID}/test.bin`,
        mime_type: null,
        original_name: 'test.bin',
        deleted_at: null,
      } as never);

      mockStorageService.downloadFile.mockResolvedValue(Buffer.from('binary'));

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/download`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/octet-stream');
    });

    it('should return 400 when user has no access to private session', async () => {
      const { cookies } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: 'other-user',
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/download`)
        .set('Cookie', cookies);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/sessions/:sessionId/files/:fileId/url', () => {
    it('should return presigned URL', async () => {
      const { cookies, mockUser } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: mockUser.id,
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: FILE_ID,
        storage_key: `sessions/${SESSION_ID}/test.txt`,
        deleted_at: null,
      } as never);

      mockStorageService.getPresignedUrl.mockResolvedValue(
        'https://storage.example.com/presigned-url',
      );

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/url?expiry=7200`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.url).toBe('https://storage.example.com/presigned-url');
      expect(response.body.data.expiresIn).toBe(7200);
    });

    it('should use default expiry when not provided', async () => {
      const { cookies, mockUser } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: mockUser.id,
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: FILE_ID,
        storage_key: `sessions/${SESSION_ID}/test.txt`,
        deleted_at: null,
      } as never);

      mockStorageService.getPresignedUrl.mockResolvedValue(
        'https://storage.example.com/presigned-url',
      );

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/url`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.data.expiresIn).toBe(3600);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(
        `/api/sessions/${SESSION_ID}/files/${FILE_ID}/url`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 404 when session not found', async () => {
      const { cookies } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/url`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
    });

    it('should return 400 when user has no access', async () => {
      const { cookies } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: 'other-user',
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/url`)
        .set('Cookie', cookies);

      expect(response.status).toBe(400);
    });

    it('should return 404 when file not found', async () => {
      const { cookies, mockUser } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: mockUser.id,
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/url`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
    });

    it('should allow URL access for participant', async () => {
      const { cookies, mockUser } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: 'other-user',
        deleted_at: null,
        visibility: 'PRIVATE',
        participants: [{ user_id: mockUser.id }],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: FILE_ID,
        storage_key: `sessions/${SESSION_ID}/test.txt`,
        deleted_at: null,
      } as never);

      mockStorageService.getPresignedUrl.mockResolvedValue(
        'https://storage.example.com/presigned-url',
      );

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/url`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
    });

    it('should allow URL access for public session', async () => {
      const { cookies } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        owner_id: 'other-user',
        deleted_at: null,
        visibility: 'PUBLIC',
        participants: [],
      } as never);

      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: FILE_ID,
        storage_key: `sessions/${SESSION_ID}/test.txt`,
        deleted_at: null,
      } as never);

      mockStorageService.getPresignedUrl.mockResolvedValue(
        'https://storage.example.com/presigned-url',
      );

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files/${FILE_ID}/url`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
    });
  });
});
