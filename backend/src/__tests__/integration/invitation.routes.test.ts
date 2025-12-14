// Invitation routes integration tests
// Tests session invitation API endpoints

import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { mockPrisma } from '../setup';
import bcrypt from 'bcryptjs';

const app = createTestApp();

// Valid CUID-like IDs for testing
const USER_ID = 'cluser00000000000001';
const SESSION_ID = 'clsession00000000001';
const INVITE_ID = 'clinvite0000000000001';

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

// Helper to login and get authenticated headers
async function loginUser(email: string = 'test@example.com', password: string = 'Password123') {
  const hashedPassword = await bcrypt.hash(password, 12);
  const mockUser = {
    id: USER_ID,
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

  // Reset mock for subsequent calls
  mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);
  mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

  return { cookies: allCookies, csrfToken, mockUser };
}

describe('Invitation Routes', () => {
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

  const mockInvitation = {
    id: INVITE_ID,
    session_id: SESSION_ID,
    email: 'invited@example.com',
    role: 'EDITOR',
    token: 'abc123token',
    accepted_at: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    created_at: new Date(),
    session: {
      id: SESSION_ID,
      name: 'Test Session',
      description: 'A test session',
    },
  };

  describe('POST /api/invitations', () => {
    it('should create an invitation as session owner', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser();

      // Setup mocks in correct order: auth middleware needs user, then service calls
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser as any) // auth middleware
        .mockResolvedValueOnce(null) // existing user check (invited user doesn't exist)
        .mockResolvedValueOnce({ id: USER_ID, name: 'Test User' } as any); // inviter name lookup
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.sessionInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.sessionInvitation.create.mockResolvedValue(mockInvitation as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/invitations')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          sessionId: SESSION_ID,
          email: 'invited@example.com',
          role: 'EDITOR',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invitation).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/invitations')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          sessionId: SESSION_ID,
          email: 'invited@example.com',
          role: 'EDITOR',
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid email', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post('/api/invitations')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          sessionId: SESSION_ID,
          email: 'invalid-email',
          role: 'EDITOR',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid role', async () => {
      const { cookies, csrfToken } = await loginUser();

      const response = await request(app)
        .post('/api/invitations')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          sessionId: SESSION_ID,
          email: 'invited@example.com',
          role: 'SUPERUSER',
        });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent session', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/invitations')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          sessionId: SESSION_ID,
          email: 'invited@example.com',
          role: 'EDITOR',
        });

      expect(response.status).toBe(404);
    });

    it('should return 403 for non-owner/non-editor', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'cldifferentowner00001',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/invitations')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          sessionId: SESSION_ID,
          email: 'invited@example.com',
          role: 'EDITOR',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/invitations/session/:sessionId', () => {
    it('should list invitations for session owner', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.sessionInvitation.findMany.mockResolvedValue([mockInvitation] as any);

      const response = await request(app)
        .get(`/api/invitations/session/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invitations).toHaveLength(1);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(`/api/invitations/session/${SESSION_ID}`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent session', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/invitations/session/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(404);
    });

    it('should return 403 for non-participant', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'cldifferentowner00001',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/invitations/session/${SESSION_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/invitations/accept/:token', () => {
    it('should accept invitation when authenticated', async () => {
      const { cookies, csrfToken, mockUser } = await loginUser('invited@example.com');

      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        session: mockSession,
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        email: 'invited@example.com',
      } as any);
      mockPrisma.sessionInvitation.update.mockResolvedValue({} as any);
      mockPrisma.participant.create.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      } as any);
      mockPrisma.session.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/invitations/accept/abc123token')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return requiresAuth when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        session: mockSession,
      } as any);

      const response = await request(app)
        .post('/api/invitations/accept/abc123token')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.data.requiresAuth).toBe(true);
    });

    it('should return 404 for invalid token', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/invitations/accept/invalid-token')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(404);
    });

    it('should return 400 for already accepted invitation', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        accepted_at: new Date(),
        session: mockSession,
      } as any);

      const response = await request(app)
        .post('/api/invitations/accept/abc123token')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(400);
    });

    it('should return 400 for expired invitation', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        expires_at: new Date(Date.now() - 1000), // Expired
        session: mockSession,
      } as any);

      const response = await request(app)
        .post('/api/invitations/accept/abc123token')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/invitations/:invitationId', () => {
    it('should revoke invitation as session owner', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        session: mockSession,
      } as any);
      mockPrisma.sessionInvitation.delete.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const response = await request(app)
        .delete(`/api/invitations/${INVITE_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation revoked successfully');
    });

    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .delete(`/api/invitations/${INVITE_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent invitation', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/invitations/${INVITE_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(404);
    });

    it('should return 403 for non-owner/non-editor', async () => {
      const { cookies, csrfToken } = await loginUser();

      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        session: { ...mockSession, owner_id: 'cldifferentowner00001' },
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/invitations/${INVITE_ID}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/invitations/verify/:token', () => {
    it('should get invitation by token (public)', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        session: {
          ...mockSession,
          owner: { name: 'Owner' },
        },
      } as any);

      const response = await request(app).get('/api/invitations/verify/abc123token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invitation).toBeDefined();
    });

    it('should return 404 for invalid token', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(null);

      const response = await request(app).get('/api/invitations/verify/invalid-token');

      expect(response.status).toBe(404);
    });

    it('should return 400 for expired invitation', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        expires_at: new Date(Date.now() - 1000), // Expired
      } as any);

      const response = await request(app).get('/api/invitations/verify/abc123token');

      expect(response.status).toBe(400);
    });

    it('should return 400 for already accepted invitation', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        accepted_at: new Date(),
      } as any);

      const response = await request(app).get('/api/invitations/verify/abc123token');

      expect(response.status).toBe(400);
    });
  });
});
