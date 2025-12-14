// Test data factories for generating consistent test data
// These factories help create mock data for unit and integration tests

import { ParticipantRole, SessionVisibility, SessionStatus } from '@prisma/client';

// User factory
export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: `user-${Date.now()}`,
  email: `test-${Date.now()}@example.com`,
  name: 'Test User',
  password: '$2a$12$hashedpassword',
  role: 'USER',
  ai_cost_limit: 10.0,
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

export interface MockUser {
  id: string;
  email: string;
  name: string;
  password: string;
  role: string;
  ai_cost_limit: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Session factory
export const createMockSession = (overrides: Partial<MockSession> = {}): MockSession => ({
  id: `session-${Date.now()}`,
  name: 'Test Session',
  description: 'A test session',
  language: 'javascript',
  owner_id: `user-${Date.now()}`,
  visibility: 'PRIVATE' as SessionVisibility,
  status: 'ACTIVE' as SessionStatus,
  max_participants: 10,
  content: '',
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

export interface MockSession {
  id: string;
  name: string;
  description: string | null;
  language: string;
  owner_id: string;
  visibility: SessionVisibility;
  status: SessionStatus;
  max_participants: number;
  content: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Participant factory
export const createMockParticipant = (overrides: Partial<MockParticipant> = {}): MockParticipant => ({
  id: `participant-${Date.now()}`,
  session_id: `session-${Date.now()}`,
  user_id: `user-${Date.now()}`,
  role: 'VIEWER' as ParticipantRole,
  cursor_line: null,
  cursor_column: null,
  joined_at: new Date(),
  left_at: null,
  last_seen: new Date(),
  ...overrides,
});

export interface MockParticipant {
  id: string;
  session_id: string;
  user_id: string;
  role: ParticipantRole;
  cursor_line: number | null;
  cursor_column: number | null;
  joined_at: Date;
  left_at: Date | null;
  last_seen: Date;
}

// Session file factory
export const createMockSessionFile = (overrides: Partial<MockSessionFile> = {}): MockSessionFile => ({
  id: `file-${Date.now()}`,
  session_id: `session-${Date.now()}`,
  path: 'index.js',
  original_name: 'index.js',
  stored_name: 'index.js',
  mime_type: 'text/javascript',
  size: 100,
  content: 'const x = 1;',
  yjs_state: null,
  storage_key: null,
  storage_url: null,
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

export interface MockSessionFile {
  id: string;
  session_id: string;
  path: string;
  original_name: string;
  stored_name: string;
  mime_type: string | null;
  size: number | null;
  content: string | null;
  yjs_state: string | null;
  storage_key: string | null;
  storage_url: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Invitation factory
export const createMockInvitation = (overrides: Partial<MockInvitation> = {}): MockInvitation => ({
  id: `invitation-${Date.now()}`,
  session_id: `session-${Date.now()}`,
  email: `invite-${Date.now()}@example.com`,
  token: `token-${Date.now()}`,
  role: 'VIEWER' as ParticipantRole,
  invited_by: `user-${Date.now()}`,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  accepted_at: null,
  created_at: new Date(),
  ...overrides,
});

export interface MockInvitation {
  id: string;
  session_id: string;
  email: string;
  token: string;
  role: ParticipantRole;
  invited_by: string;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
}

// Snapshot factory
export const createMockSnapshot = (overrides: Partial<MockSnapshot> = {}): MockSnapshot => ({
  id: `snapshot-${Date.now()}`,
  session_id: `session-${Date.now()}`,
  file_path: 'index.js',
  yjs_state: 'base64encodedstate',
  change_summary: 'Initial snapshot',
  lines_added: 10,
  lines_removed: 0,
  created_by: `user-${Date.now()}`,
  deleted_at: null,
  created_at: new Date(),
  ...overrides,
});

export interface MockSnapshot {
  id: string;
  session_id: string;
  file_path: string;
  yjs_state: string;
  change_summary: string | null;
  lines_added: number;
  lines_removed: number;
  created_by: string;
  deleted_at: Date | null;
  created_at: Date;
}

// Message factory
export const createMockMessage = (overrides: Partial<MockMessage> = {}): MockMessage => ({
  id: `message-${Date.now()}`,
  session_id: `session-${Date.now()}`,
  user_id: `user-${Date.now()}`,
  content: 'Test message content',
  type: 'TEXT',
  parent_id: null,
  deleted_at: null,
  created_at: new Date(),
  ...overrides,
});

export interface MockMessage {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  type: string;
  parent_id: string | null;
  deleted_at: Date | null;
  created_at: Date;
}

// Password reset factory
export const createMockPasswordReset = (overrides: Partial<MockPasswordReset> = {}): MockPasswordReset => ({
  id: `reset-${Date.now()}`,
  user_id: `user-${Date.now()}`,
  token: `hashedtoken-${Date.now()}`,
  expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  used_at: null,
  created_at: new Date(),
  ...overrides,
});

export interface MockPasswordReset {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

// Audit log factory
export const createMockAuditLog = (overrides: Partial<MockAuditLog> = {}): MockAuditLog => ({
  id: `audit-${Date.now()}`,
  user_id: `user-${Date.now()}`,
  action: 'CREATE',
  resource_type: 'session',
  resource_id: `session-${Date.now()}`,
  old_values: null,
  new_values: null,
  ip_address: '127.0.0.1',
  user_agent: 'Jest Test',
  created_at: new Date(),
  ...overrides,
});

export interface MockAuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

// Valid test data for validators
export const validUserData = {
  email: 'test@example.com',
  password: 'Password123',
  name: 'Test User',
};

export const validSessionData = {
  name: 'Test Session',
  description: 'A test description',
  language: 'javascript' as const,
  visibility: 'PRIVATE' as const,
};

export const validCuid = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';

// Generate a valid CUID for testing
export const generateCuid = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'cl';
  for (let i = 0; i < 25; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
