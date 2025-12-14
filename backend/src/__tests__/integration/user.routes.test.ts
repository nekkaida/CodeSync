// User routes integration tests
// Tests user API endpoints

import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { mockPrisma } from '../setup';
import bcrypt from 'bcryptjs';

const app = createTestApp();

// Valid CUID-like IDs for testing
const USER_ID = 'cluser00000000000001';
const USER_ID_2 = 'cluser00000000000002';
const ADMIN_ID = 'cladmin0000000000001';
const SESSION_ID = 'clsession00000000001';

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
  role: string = 'USER',
  userId: string = USER_ID,
) {
  const hashedPassword = await bcrypt.hash(password, 12);
  const mockUser = {
    id: userId,
    email,
    name: 'Test User',
    role,
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

describe('User Routes', () => {
  describe('GET /api/users/:userId', () => {
    it('should get user by id when authenticated', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      const response = await request(app)
        .get(`/api/users/${USER_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(`/api/users/${USER_ID}`);
      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid user id format', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .get('/api/users/invalid-id-format!')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/users/:userId', () => {
    it('should update own profile', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, name: 'Updated Name' } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .patch(`/api/users/${USER_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.name).toBe('Updated Name');
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .patch(`/api/users/${USER_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(401);
    });

    it('should return 403 when updating another user (non-admin)', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      const response = await request(app)
        .patch(`/api/users/${USER_ID_2}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Hacked Name' });

      expect(response.status).toBe(403);
    });

    it('should allow admin to update another user', async () => {
      const { cookies, csrfToken } = await loginUser('admin@example.com', 'Password123', 'ADMIN', ADMIN_ID);
      mockPrisma.user.findUnique.mockResolvedValue({ id: ADMIN_ID, email: 'admin@example.com', role: 'ADMIN' } as any);
      mockPrisma.user.update.mockResolvedValue({ id: USER_ID_2, email: 'other@example.com', name: 'Admin Updated', role: 'USER', ai_cost_limit: 10.0, updated_at: new Date() } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .patch(`/api/users/${USER_ID_2}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Admin Updated' });

      expect(response.status).toBe(200);
    });

    it('should update ai_cost_limit', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, ai_cost_limit: 25.0 } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .patch(`/api/users/${USER_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ ai_cost_limit: 25.0 });

      expect(response.status).toBe(200);
      expect(response.body.data.user.ai_cost_limit).toBe(25.0);
    });
  });

  describe('DELETE /api/users/:userId', () => {
    it('should delete own account (soft delete)', async () => {
      const { cookies, csrfToken } = await loginUser();
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .delete(`/api/users/${USER_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User deleted successfully');
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .delete(`/api/users/${USER_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(401);
    });

    it('should return 403 when deleting another user (non-admin)', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      const response = await request(app)
        .delete(`/api/users/${USER_ID_2}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/users/:userId/sessions', () => {
    it('should get user sessions', async () => {
      const { cookies, csrfToken } = await loginUser();
      mockPrisma.session.findMany.mockResolvedValue([{ id: SESSION_ID, name: 'Test Session', owner: { id: USER_ID, name: 'Test', email: 'test@example.com' }, participants: [] }] as any);
      mockPrisma.session.count.mockResolvedValue(1);

      const response = await request(app)
        .get(`/api/users/${USER_ID}/sessions`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toBeDefined();
      expect(response.body.data.total).toBe(1);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(`/api/users/${USER_ID}/sessions`);
      expect(response.status).toBe(401);
    });

    it('should support pagination', async () => {
      const { cookies, csrfToken } = await loginUser();
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      const response = await request(app)
        .get(`/api/users/${USER_ID}/sessions?limit=10&offset=5`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.data.limit).toBe(10);
      expect(response.body.data.offset).toBe(5);
    });
  });

  describe('GET /api/users/:userId/ai-usage', () => {
    it('should get AI usage statistics', async () => {
      const { cookies, csrfToken } = await loginUser();
      mockPrisma.aIUsage.findMany.mockResolvedValue([{ id: 'clusage0000000000001', user_id: USER_ID, model: 'gpt-4', tokens_used: 1000, cost_usd: 0.5, request_type: 'chat', prompt_length: 500, response_length: 500, created_at: new Date() }]);

      const response = await request(app)
        .get(`/api/users/${USER_ID}/ai-usage`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalTokens).toBe(1000);
    });

    it('should support days query parameter', async () => {
      const { cookies, csrfToken } = await loginUser();
      mockPrisma.aIUsage.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/users/${USER_ID}/ai-usage?days=7`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(`/api/users/${USER_ID}/ai-usage`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/users/:userId/audit-log', () => {
    it('should get user audit log', async () => {
      const { cookies, csrfToken } = await loginUser();
      mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'clauditlog0000000001', user_id: USER_ID, action: 'CREATE', resource_type: 'session', resource_id: SESSION_ID, created_at: new Date() }] as any);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const response = await request(app)
        .get(`/api/users/${USER_ID}/audit-log`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toBeDefined();
      expect(response.body.data.total).toBe(1);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(`/api/users/${USER_ID}/audit-log`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/users (Admin)', () => {
    it('should list all users for admin', async () => {
      const { cookies, csrfToken } = await loginUser('admin@example.com', 'Password123', 'ADMIN', ADMIN_ID);
      mockPrisma.user.findUnique.mockResolvedValue({ id: ADMIN_ID, role: 'ADMIN' } as any);
      mockPrisma.user.findMany.mockResolvedValue([{ id: USER_ID, email: 'user1@example.com', name: 'User 1', role: 'USER' }] as any);
      mockPrisma.user.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/users')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeDefined();
    });

    it('should return 403 for non-admin', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .get('/api/users')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(403);
    });

    it('should filter by role', async () => {
      const { cookies, csrfToken } = await loginUser('admin@example.com', 'Password123', 'ADMIN', ADMIN_ID);
      mockPrisma.user.findUnique.mockResolvedValue({ id: ADMIN_ID, role: 'ADMIN' } as any);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/users?role=ADMIN')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
    });
  });

  describe('PATCH /api/users/:userId/role (Admin)', () => {
    it('should update user role for admin', async () => {
      const { cookies, csrfToken } = await loginUser('admin@example.com', 'Password123', 'ADMIN', ADMIN_ID);
      mockPrisma.user.findUnique.mockResolvedValue({ id: ADMIN_ID, role: 'ADMIN' } as any);
      mockPrisma.user.update.mockResolvedValue({ id: USER_ID, email: 'user1@example.com', name: 'User 1', role: 'MODERATOR' } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .patch(`/api/users/${USER_ID}/role`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ role: 'MODERATOR' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('MODERATOR');
    });

    it('should return 403 for non-admin', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .patch(`/api/users/${USER_ID_2}/role`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ role: 'ADMIN' });

      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid role', async () => {
      const { cookies, csrfToken } = await loginUser('admin@example.com', 'Password123', 'ADMIN', ADMIN_ID);

      const response = await request(app)
        .patch(`/api/users/${USER_ID}/role`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ role: 'SUPERADMIN' });

      expect(response.status).toBe(400);
    });
  });
});
