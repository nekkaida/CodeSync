// Auth routes integration tests
// Tests authentication API endpoints

import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { mockPrisma } from '../setup';
import bcrypt from 'bcryptjs';

const app = createTestApp();

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

describe('Auth Routes', () => {
  describe('GET /api/auth/csrf', () => {
    it('should return CSRF token', async () => {
      const response = await request(app).get('/api/auth/csrf');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        password: 'hashed',
        deleted_at: null,
        deleted_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        ai_cost_limit: 10.0,
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
    });

    it('should return 400 for invalid email', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          email: 'invalid-email',
          password: 'Password123',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for weak password', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing name', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(400);
    });

    it('should return 409 for existing email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'existing@example.com',
        name: 'Existing User',
        role: 'USER',
        password: 'hashed',
        deleted_at: null,
        deleted_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        ai_cost_limit: 10.0,
      } as any);

      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/register')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          email: 'existing@example.com',
          password: 'Password123',
          name: 'Test User',
        });

      expect(response.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        password: hashedPassword,
        deleted_at: null,
        deleted_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        ai_cost_limit: 10.0,
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/login')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      // Should set httpOnly cookie
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 401 for invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/login')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(401);
    });

    it('should return 401 for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        password: hashedPassword,
        deleted_at: null,
        deleted_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        ai_cost_limit: 10.0,
      } as any);

      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/login')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123',
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for missing email', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/login')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          password: 'Password123',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should return 401 when not authenticated', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          currentPassword: 'OldPassword123',
          newPassword: 'NewPassword123',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should return success for any email (security)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          email: 'nonexistent@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account exists');
    });

    it('should return 400 for invalid email format', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing email', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/reset-password/:token', () => {
    it('should return success for valid token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue({
        id: 'reset-1',
        token: 'hashed-token',
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
      } as any);

      const response = await request(app).get('/api/auth/reset-password/valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token is valid');
    });

    it('should return 400 for invalid token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(null);

      const response = await request(app).get('/api/auth/reset-password/invalid-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue({
        id: 'reset-1',
        user_id: 'user-1',
        token: 'hashed-token',
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          deleted_at: null,
        },
      } as any);
      mockPrisma.user.update.mockResolvedValue({} as any);
      mockPrisma.passwordReset.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          token: 'valid-reset-token',
          newPassword: 'NewPassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password reset successfully');
    });

    it('should return 401 for invalid token', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue(null);

      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword123',
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for weak password', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          token: 'valid-token',
          newPassword: 'weak',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing token', async () => {
      const { cookies, csrfToken } = await getAuthHeaders();

      const response = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          newPassword: 'NewPassword123',
        });

      expect(response.status).toBe(400);
    });
  });
});

describe('Health Check', () => {
  it('should return health status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
