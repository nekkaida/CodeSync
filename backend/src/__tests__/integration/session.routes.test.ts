// Session routes integration tests
// Tests session API endpoints

import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { mockPrisma } from '../setup';
import bcrypt from 'bcryptjs';

const app = createTestApp();

// Valid CUID-like IDs for testing
const USER_ID = 'cluser00000000000001';
const USER_ID_2 = 'cluser00000000000002';
const SESSION_ID = 'clsession00000000001';
const FILE_ID = 'clfile000000000000001';

const getCookies = (response: request.Response): string[] => {
  const cookies = response.headers['set-cookie'];
  if (!cookies) return [];
  if (Array.isArray(cookies)) return cookies;
  return [cookies];
};

async function getAuthHeaders() {
  const csrfResponse = await request(app).get('/api/auth/csrf');
  const cookies = getCookies(csrfResponse);
  const csrfToken = csrfResponse.body.data?.token || '';
  return { cookies, csrfToken };
}

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

describe('Session Routes', () => {
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
    participants: [],
  };

  describe('POST /api/sessions', () => {
    it('should create a session when authenticated', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.create.mockResolvedValue(mockSession as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/sessions')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          name: 'Test Session',
          description: 'A test session',
          language: 'typescript',
          visibility: 'PRIVATE',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.session).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/sessions')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          name: 'Test Session',
          language: 'typescript',
          visibility: 'PRIVATE',
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid language', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post('/api/sessions')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          name: 'Test Session',
          language: 'invalid-language',
          visibility: 'PRIVATE',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid visibility', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post('/api/sessions')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          name: 'Test Session',
          language: 'typescript',
          visibility: 'INVALID',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for name too short', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post('/api/sessions')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          name: 'ab',
          language: 'typescript',
          visibility: 'PRIVATE',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/sessions', () => {
    it('should list public sessions without auth', async () => {
      mockPrisma.session.findMany.mockResolvedValue([mockSession] as any);
      mockPrisma.session.count.mockResolvedValue(1);

      const response = await request(app).get('/api/sessions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toBeDefined();
    });

    it('should list sessions for authenticated user', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findMany.mockResolvedValue([mockSession] as any);
      mockPrisma.session.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/sessions')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should support pagination', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      const response = await request(app).get('/api/sessions?limit=10&offset=5');

      expect(response.status).toBe(200);
    });

    it('should filter by visibility', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      const response = await request(app).get('/api/sessions?visibility=PUBLIC');

      expect(response.status).toBe(200);
    });

    it('should filter by language', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      const response = await request(app).get('/api/sessions?language=typescript');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/sessions/:sessionId', () => {
    it('should get session by ID', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.session).toBeDefined();
    });

    it('should return 400 for invalid session ID', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .get('/api/sessions/invalid-id!')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent session', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/sessions/:sessionId', () => {
    it('should update session as owner', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.session.update.mockResolvedValue({
        ...mockSession,
        name: 'Updated Session',
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .patch(`/api/sessions/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Updated Session' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .patch(`/api/sessions/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Updated Session' });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid session ID', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .patch('/api/sessions/invalid-id!')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Updated Session' });

      expect(response.status).toBe(400);
    });

    it('should return 403 for non-owner', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'cldifferentowner00001',
      } as any);

      const response = await request(app)
        .patch(`/api/sessions/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Updated Session' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/sessions/:sessionId', () => {
    it('should delete session as owner', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.session.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .delete(`/api/sessions/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Session deleted successfully');
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .delete(`/api/sessions/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent session', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/sessions/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/sessions/:sessionId/participants', () => {
    it('should add participant to session', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser as any) // auth middleware
        .mockResolvedValueOnce({ id: USER_ID_2, name: 'Other User' } as any); // participant user
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.participant.create.mockResolvedValue({
        id: 'clparticipant00000001',
        session_id: SESSION_ID,
        user_id: USER_ID_2,
        role: 'EDITOR',
      } as any);
      mockPrisma.session.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/participants`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          userId: USER_ID_2,
          role: 'EDITOR',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/participants`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          userId: USER_ID_2,
          role: 'EDITOR',
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid role', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/participants`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          userId: USER_ID_2,
          role: 'INVALID_ROLE',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/sessions/:sessionId/participants/:userId', () => {
    it('should remove participant from session', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue({
        id: 'clparticipant00000001',
        session_id: SESSION_ID,
        user_id: USER_ID_2,
        role: 'EDITOR',
      } as any);
      mockPrisma.participant.update.mockResolvedValue({} as any);
      mockPrisma.session.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .delete(`/api/sessions/${SESSION_ID}/participants/${USER_ID_2}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .delete(`/api/sessions/${SESSION_ID}/participants/${USER_ID_2}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/sessions/:sessionId/cursor', () => {
    it('should update cursor position', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue({
        id: 'clparticipant00000001',
        session_id: SESSION_ID,
        user_id: USER_ID,
        role: 'OWNER',
      } as any);
      mockPrisma.participant.update.mockResolvedValue({} as any);

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/cursor`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ line: 10, column: 5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid cursor position', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/cursor`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ line: -1, column: 5 });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/sessions/:sessionId/content', () => {
    it('should get session content', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        content: 'console.log("Hello");',
      } as any);

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/content`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(`/api/sessions/${SESSION_ID}/content`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/sessions/:sessionId/files', () => {
    it('should get session files', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.sessionFile.findMany.mockResolvedValue([
        {
          id: FILE_ID,
          session_id: SESSION_ID,
          name: 'test.ts',
          type: 'file',
          path: '/test.ts',
        },
      ] as any);

      const response = await request(app)
        .get(`/api/sessions/${SESSION_ID}/files`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.files).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(`/api/sessions/${SESSION_ID}/files`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/sessions/:sessionId/files', () => {
    it('should create a file in session', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.sessionFile.create.mockResolvedValue({
        id: FILE_ID,
        session_id: SESSION_ID,
        name: 'newfile.ts',
        type: 'file',
        path: '/newfile.ts',
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/files`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'newfile.ts', type: 'file' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.file).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post(`/api/sessions/${SESSION_ID}/files`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'newfile.ts', type: 'file' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/sessions/:sessionId/files/:fileId', () => {
    it('should delete a file from session', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.sessionFile.findUnique.mockResolvedValue({
        id: FILE_ID,
        session_id: SESSION_ID,
        name: 'test.ts',
        type: 'file',
      } as any);
      mockPrisma.sessionFile.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .delete(`/api/sessions/${SESSION_ID}/files/${FILE_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .delete(`/api/sessions/${SESSION_ID}/files/${FILE_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(401);
    });
  });
});
