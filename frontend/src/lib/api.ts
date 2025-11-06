import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
  withCredentials: true, // Important for httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add CSRF token
api.interceptors.request.use(
  (config) => {
    // Get CSRF token from cookie
    const csrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrf-token='))
      ?.split('=')[1];

    if (csrfToken) {
      config.headers['x-csrf-token'] = csrfToken;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;

      if (status === 401) {
        // Unauthorized - redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }

      // Return formatted error
      return Promise.reject({
        status,
        message: data?.error?.message || 'An error occurred',
        code: data?.error?.code || 'UNKNOWN_ERROR',
      });
    } else if (error.request) {
      // Request made but no response
      return Promise.reject({
        status: 0,
        message: 'No response from server',
        code: 'NETWORK_ERROR',
      });
    } else {
      // Something else happened
      return Promise.reject({
        status: 0,
        message: error.message || 'An error occurred',
        code: 'REQUEST_ERROR',
      });
    }
  }
);

// Auth API
export const authAPI = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  getCurrentUser: () => api.get('/auth/me'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
};

// Sessions API
export const sessionsAPI = {
  create: (data: {
    name: string;
    description?: string;
    language: string;
    visibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  }) => api.post('/sessions', data),

  list: (params?: { limit?: number; offset?: number }) =>
    api.get('/sessions', { params }),

  get: (id: string) => api.get(`/sessions/${id}`),

  update: (id: string, data: Partial<{ name: string; description: string; status: string }>) =>
    api.patch(`/sessions/${id}`, data),

  delete: (id: string) => api.delete(`/sessions/${id}`),

  addParticipant: (sessionId: string, data: { userId: string; role?: string }) =>
    api.post(`/sessions/${sessionId}/participants`, data),

  removeParticipant: (sessionId: string, userId: string) =>
    api.delete(`/sessions/${sessionId}/participants/${userId}`),

  updateCursor: (sessionId: string, data: { line: number; column: number }) =>
    api.patch(`/sessions/${sessionId}/cursor`, data),
};

// Users API
export const usersAPI = {
  get: (id: string) => api.get(`/users/${id}`),

  update: (id: string, data: Partial<{ name: string; email: string }>) =>
    api.patch(`/users/${id}`, data),

  delete: (id: string) => api.delete(`/users/${id}`),

  getSessions: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/users/${id}/sessions`, { params }),

  getAIUsage: (id: string, params?: { startDate?: string; endDate?: string }) =>
    api.get(`/users/${id}/ai-usage`, { params }),

  getAuditLog: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/users/${id}/audit-log`, { params }),
};

// Health check
export const healthAPI = {
  check: () => axios.get(`${API_URL}/health`),
};

export default api;
