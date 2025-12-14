// Session routes integration tests
// Tests session API endpoints

import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { mockPrisma } from '../setup';
import bcrypt from 'bcryptjs';

const app = createTestApp();

// Valid CUID for testing
const VALID_SESSION_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const VALID_USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';

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
async function loginUser(email: string = 'test@example.com', password: string = 'Password123') {
  const hashedPassword = await bcrypt.hash(password, 12);
  const mockUser = {
    id: 'user-1',
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

  // Verify login succeeded
  if (loginResponse.status !== 200) {
    throw new Error(`Login failed with status ${loginResponse.status}: ${JSON.stringify(loginResponse.body)}`);
  }

  const authCookies = getCookies(loginResponse);

  // Merge CSRF cookies with auth cookies
  const allCookies = [...cookies, ...authCookies.filter(c => c.includes('token='))];

  // Set up mocks for subsequent authenticated requests
  // tokenBlacklist.findUnique returns null (token not blacklisted)
  // user.findUnique returns the mock user for token verification
  mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);
  mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

  return { cookies: allCookies, csrfToken };
}

describe('Session Routes', () => {
  describe('POST /api/sessions', () => {
    it('should create a new session successfully', async () => {
      const mockSession = {
        id: VALID_SESSION_ID,
        name: 'Test Session',
        description: 'A test session',
        language: 'javascript',
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        owner_id: 'user-1',
        max_participants: 10,
        participants_count: 0,
        last_activity: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null,
      };

      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.create.mockResolvedValue(mockSession as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/sessions')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          name: 'Test Session',
          description: 'A test session',
          language: 'javascript',
          visibility: 'PRIVATE',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.session.id).toBe(VALID_SESSION_ID);
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/sessions')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          name: 'Test Session',
          language: 'javascript',
          visibility: 'PRIVATE',
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid session name (too short)', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post('/api/sessions')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          name: 'ab', // Too short (min 3)
          language: 'javascript',
          visibility: 'PRIVATE',
        });

      expect(response.status).toBe(400);
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

    it('should return 400 for missing visibility', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post('/api/sessions')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          name: 'Test Session',
          language: 'javascript',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/sessions', () => {
    it('should list sessions (optionalAuth allows unauthenticated)', async () => {
      const mockSessions = [
        {
          id: VALID_SESSION_ID,
          name: 'Public Session',
          language: 'javascript',
          visibility: 'PUBLIC',
          status: 'ACTIVE',
          owner_id: VALID_USER_ID,
          created_at: new Date(),
          owner: { id: VALID_USER_ID, name: 'Test User', email: 'test@example.com' },
          _count: { participants: 1 },
        },
      ];

      mockPrisma.session.findMany.mockResolvedValue(mockSessions as any);
      mockPrisma.session.count.mockResolvedValue(1);

      const response = await request(app).get('/api/sessions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should filter sessions by visibility', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/sessions')
        .query({ visibility: 'PUBLIC' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should filter sessions by language', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/sessions')
        .query({ language: 'typescript' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/sessions/:sessionId', () => {
    it('should get session by id for owner', async () => {
      const mockSession = {
        id: VALID_SESSION_ID,
        name: 'Test Session',
        language: 'javascript',
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        owner_id: 'user-1',
        deleted_at: null,
        created_at: new Date(),
        owner: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        participants: [],
        files: [],
      };

      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      const response = await request(app)
        .get(`/api/sessions/${VALID_SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.session.id).toBe(VALID_SESSION_ID);
    });

    it('should get public session without auth', async () => {
      const mockSession = {
        id: VALID_SESSION_ID,
        name: 'Public Session',
        language: 'javascript',
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        owner_id: VALID_USER_ID,
        deleted_at: null,
        created_at: new Date(),
        owner: { id: VALID_USER_ID, name: 'Test User', email: 'test@example.com' },
        participants: [],
        files: [],
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      const response = await request(app)
        .get(`/api/sessions/${VALID_SESSION_ID}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent session', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/sessions/${VALID_SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid session ID format', async () => {
      const response = await request(app)
        .get('/api/sessions/invalid-id');

      expect(response.status).toBe(400);
    });

    it('should return 403 for unauthorized access to private session', async () => {
      const mockSession = {
        id: VALID_SESSION_ID,
        name: 'Private Session',
        language: 'javascript',
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        owner_id: VALID_USER_ID, // Different user
        deleted_at: null,
        created_at: new Date(),
        owner: { id: VALID_USER_ID, name: 'Other User', email: 'other@example.com' },
        participants: [],
        files: [],
      };

      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      const response = await request(app)
        .get(`/api/sessions/${VALID_SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/sessions/:sessionId', () => {
    it('should update session for owner', async () => {
      const mockSession = {
        id: VALID_SESSION_ID,
        name: 'Test Session',
        language: 'javascript',
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        owner_id: 'user-1',
        deleted_at: null,
      };

      const updatedSession = {
        ...mockSession,
        name: 'Updated Session',
        description: 'Updated description',
      };

      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.session.update.mockResolvedValue(updatedSession as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .patch(`/api/sessions/${VALID_SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          name: 'Updated Session',
          description: 'Updated description',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.session.name).toBe('Updated Session');
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .patch(`/api/sessions/${VALID_SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Updated Session' });

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-owner', async () => {
      const mockSession = {
        id: VALID_SESSION_ID,
        name: 'Test Session',
        owner_id: VALID_USER_ID, // Different user
        status: 'ACTIVE',
        deleted_at: null,
      };

      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      const response = await request(app)
        .patch(`/api/sessions/${VALID_SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Updated Session' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/sessions/:sessionId', () => {
    it('should delete session for owner', async () => {
      const mockSession = {
        id: VALID_SESSION_ID,
        name: 'Test Session',
        owner_id: 'user-1',
        status: 'ACTIVE',
        deleted_at: null,
      };

      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.session.update.mockResolvedValue({
        ...mockSession,
        deleted_at: new Date(),
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .delete(`/api/sessions/${VALID_SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .delete(`/api/sessions/${VALID_SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-owner', async () => {
      const mockSession = {
        id: VALID_SESSION_ID,
        name: 'Test Session',
        owner_id: VALID_USER_ID, // Different user
        status: 'ACTIVE',
        deleted_at: null,
      };

      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);

      const response = await request(app)
        .delete(`/api/sessions/${VALID_SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/sessions/:sessionId/participants', () => {
    it('should add participant to session', async () => {
      const mockSession = {
        id: VALID_SESSION_ID,
        owner_id: 'user-1',
        max_participants: 10,
        status: 'ACTIVE',
        deleted_at: null,
      };

      const mockTargetUser = {
        id: VALID_USER_ID,
        email: 'participant@example.com',
        deleted_at: null,
      };

      const mockParticipant = {
        id: 'clparticipant00000000000',
        session_id: VALID_SESSION_ID,
        user_id: VALID_USER_ID,
        role: 'VIEWER',
        joined_at: new Date(),
        left_at: null,
      };

      const { cookies, csrfToken } = await loginUser();

      // Override user.findUnique to return different users based on call order
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockTargetUser as any);
      mockPrisma.participant.count.mockResolvedValue(5);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.participant.create.mockResolvedValue(mockParticipant as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .post(`/api/sessions/${VALID_SESSION_ID}/participants`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          userId: VALID_USER_ID,
          role: 'VIEWER',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid role', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post(`/api/sessions/${VALID_SESSION_ID}/participants`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          userId: VALID_USER_ID,
          role: 'INVALID_ROLE',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/sessions/:sessionId/participants/:userId', () => {
    it('should remove participant from session', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        id: VALID_SESSION_ID,
        owner_id: 'user-1',
        status: 'ACTIVE',
        deleted_at: null,
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue({
        id: 'participant-1',
        session_id: VALID_SESSION_ID,
        user_id: VALID_USER_ID,
        left_at: null,
      } as any);
      mockPrisma.participant.update.mockResolvedValue({} as any);
      mockPrisma.session.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .delete(`/api/sessions/${VALID_SESSION_ID}/participants/${VALID_USER_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/sessions/:sessionId/cursor', () => {
    it('should update cursor position', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.participant.update.mockResolvedValue({} as any);

      const response = await request(app)
        .post(`/api/sessions/${VALID_SESSION_ID}/cursor`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          line: 10,
          column: 5,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid cursor position', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post(`/api/sessions/${VALID_SESSION_ID}/cursor`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          line: -1, // Invalid negative value
          column: 5,
        });

      expect(response.status).toBe(400);
    });
  });
});
