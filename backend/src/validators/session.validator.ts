// Zod validation schemas for sessions

import { z } from 'zod';

// Programming languages enum
const programmingLanguages = [
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'rust',
  'cpp',
  'csharp',
  'php',
  'ruby',
] as const;

// Session visibility enum
const visibilityOptions = ['PUBLIC', 'PRIVATE', 'UNLISTED'] as const;

// Session status enum
const statusOptions = ['ACTIVE', 'ARCHIVED', 'PAUSED'] as const;

// Participant role enum
const participantRoles = ['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER'] as const;

// Create session schema
export const createSessionSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(3, 'Name must be at least 3 characters')
      .max(100, 'Name must not exceed 100 characters')
      .trim(),
    description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
    language: z.enum(programmingLanguages, {
      errorMap: () => ({ message: 'Invalid programming language' }),
    }),
    visibility: z.enum(visibilityOptions, {
      errorMap: () => ({ message: 'Invalid visibility option' }),
    }),
  }),
});

// Update session schema
export const updateSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().cuid('Invalid session ID'),
  }),
  body: z.object({
    name: z
      .string()
      .min(3, 'Name must be at least 3 characters')
      .max(100, 'Name must not exceed 100 characters')
      .trim()
      .optional(),
    description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
    language: z.enum(programmingLanguages).optional(),
    visibility: z.enum(visibilityOptions).optional(),
    status: z.enum(statusOptions).optional(),
  }),
});

// Get session schema
export const getSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().cuid('Invalid session ID'),
  }),
});

// List sessions schema
export const listSessionsSchema = z.object({
  query: z.object({
    visibility: z.enum(visibilityOptions).optional(),
    language: z.enum(programmingLanguages).optional(),
    status: z.enum(statusOptions).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

// Add participant schema
export const addParticipantSchema = z.object({
  params: z.object({
    sessionId: z.string().cuid('Invalid session ID'),
  }),
  body: z.object({
    userId: z.string().cuid('Invalid user ID'),
    role: z.enum(participantRoles, {
      errorMap: () => ({ message: 'Invalid participant role' }),
    }),
  }),
});

// Remove participant schema
export const removeParticipantSchema = z.object({
  params: z.object({
    sessionId: z.string().cuid('Invalid session ID'),
    userId: z.string().cuid('Invalid user ID'),
  }),
});

// Update cursor position schema
export const updateCursorSchema = z.object({
  params: z.object({
    sessionId: z.string().cuid('Invalid session ID'),
  }),
  body: z.object({
    line: z.number().int().min(0),
    column: z.number().int().min(0),
  }),
});

// Export types
export type CreateSessionInput = z.infer<typeof createSessionSchema>['body'];
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>['body'];
export type AddParticipantInput = z.infer<typeof addParticipantSchema>['body'];
