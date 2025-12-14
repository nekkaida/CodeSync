// Snapshot routes integration tests
// Tests snapshot API endpoints

import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { mockPrisma } from '../setup';
import bcrypt from 'bcryptjs';

const app = createTestApp();

// Valid CUID-like IDs for testing
const USER_ID = 'cluser00000000000001';
const SESSION_ID = 'clsession00000000001';
const SNAPSHOT_ID = 'clsnapshot000000001';

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

describe('Snapshot Routes', () => {
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
  };

  const mockSnapshot = {
    id: SNAPSHOT_ID,
    session_id: SESSION_ID,
    created_by: USER_ID,
    yjs_state: Buffer.from('test-state'),
    change_summary: 'Test snapshot',
    lines_added: 10,
    lines_removed: 5,
    created_at: new Date(),
    session: mockSession,
    creator: {
      id: USER_ID,
      name: 'Test User',
      email: 'test@example.com',
    },
  };

  describe('POST /api/snapshots', () => {
    it('should create a snapshot as session participant', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.codeSnapshot.create.mockResolvedValue(mockSnapshot as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/snapshots')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          sessionId: SESSION_ID,
          yjsState: 'test-yjs-state-base64',
          changeSummary: 'Test snapshot',
          linesAdded: 10,
          linesRemoved: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.snapshot).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/snapshots')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          sessionId: SESSION_ID,
          yjsState: 'test-yjs-state',
          changeSummary: 'Test snapshot',
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid session ID', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post('/api/snapshots')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          sessionId: 'invalid-id!',
          yjsState: 'test-yjs-state',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing yjsState', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post('/api/snapshots')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          sessionId: SESSION_ID,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/snapshots/session/:sessionId', () => {
    it('should list snapshots for session participant', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.codeSnapshot.findMany.mockResolvedValue([mockSnapshot] as any);
      mockPrisma.codeSnapshot.count.mockResolvedValue(1);

      const response = await request(app)
        .get(`/api/snapshots/session/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.snapshots).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(`/api/snapshots/session/${SESSION_ID}`);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid session ID', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .get('/api/snapshots/session/invalid-id!')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(400);
    });

    it('should support pagination', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.codeSnapshot.findMany.mockResolvedValue([]);
      mockPrisma.codeSnapshot.count.mockResolvedValue(0);

      const response = await request(app)
        .get(`/api/snapshots/session/${SESSION_ID}?limit=10&offset=5`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
    });

    it('should return 403 for non-participant', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'cldifferentowner00001',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/snapshots/session/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/snapshots/:snapshotId', () => {
    it('should get snapshot by ID', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);

      const response = await request(app)
        .get(`/api/snapshots/${SNAPSHOT_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.snapshot).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(`/api/snapshots/${SNAPSHOT_ID}`);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid snapshot ID', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .get('/api/snapshots/invalid-id!')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent snapshot', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/snapshots/${SNAPSHOT_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/snapshots/:snapshotId/restore', () => {
    it('should restore snapshot as session owner', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.codeSnapshot.create.mockResolvedValue({
        ...mockSnapshot,
        id: 'clsnapshot000000002',
        change_summary: 'Restored from snapshot',
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .post(`/api/snapshots/${SNAPSHOT_ID}/restore`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post(`/api/snapshots/${SNAPSHOT_ID}/restore`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid snapshot ID', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post('/api/snapshots/invalid-id!/restore')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent snapshot', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/snapshots/${SNAPSHOT_ID}/restore`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(404);
    });

    it('should return 403 for non-owner', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue({
        ...mockSnapshot,
        session: {
          ...mockSession,
          owner_id: 'cldifferentowner00001',
        },
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/snapshots/${SNAPSHOT_ID}/restore`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/snapshots/:snapshotId', () => {
    it('should delete snapshot as session owner', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(mockSnapshot as any);
      mockPrisma.codeSnapshot.delete.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .delete(`/api/snapshots/${SNAPSHOT_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Snapshot deleted successfully');
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .delete(`/api/snapshots/${SNAPSHOT_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid snapshot ID', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .delete('/api/snapshots/invalid-id!')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent snapshot', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/snapshots/${SNAPSHOT_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(404);
    });

    it('should return 403 for non-owner', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.codeSnapshot.findUnique.mockResolvedValue({
        ...mockSnapshot,
        session: {
          ...mockSession,
          owner_id: 'cldifferentowner00001',
        },
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/snapshots/${SNAPSHOT_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(403);
    });
  });
});
