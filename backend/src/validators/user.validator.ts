// Zod validation schemas for users

import { z } from 'zod';

// Get user schema
export const getUserSchema = z.object({
  params: z.object({
    userId: z.string().cuid('Invalid user ID'),
  }),
});

// Update user schema
export const updateUserSchema = z.object({
  params: z.object({
    userId: z.string().cuid('Invalid user ID'),
  }),
  body: z.object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must not exceed 100 characters')
      .trim()
      .optional(),
    ai_cost_limit: z
      .number()
      .min(0, 'AI cost limit must be non-negative')
      .max(1000, 'AI cost limit cannot exceed 1000')
      .optional(),
  }),
});

// List users schema (admin)
export const listUsersSchema = z.object({
  query: z.object({
    role: z.enum(['USER', 'ADMIN', 'MODERATOR']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

// Update user role schema (admin)
export const updateRoleSchema = z.object({
  params: z.object({
    userId: z.string().cuid('Invalid user ID'),
  }),
  body: z.object({
    role: z.enum(['USER', 'ADMIN', 'MODERATOR'], {
      errorMap: () => ({ message: 'Invalid role' }),
    }),
  }),
});

// Get user sessions schema
export const getUserSessionsSchema = z.object({
  params: z.object({
    userId: z.string().cuid('Invalid user ID'),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

// Get AI usage stats schema
export const getAIUsageSchema = z.object({
  params: z.object({
    userId: z.string().cuid('Invalid user ID'),
  }),
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
  }),
});

// Get audit log schema
export const getAuditLogSchema = z.object({
  params: z.object({
    userId: z.string().cuid('Invalid user ID'),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

// Export types
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>['body'];
