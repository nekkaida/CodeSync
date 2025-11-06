// Invitation validators

import { z } from 'zod';
import { ParticipantRole } from '@prisma/client';

export const createInvitationSchema = z.object({
  body: z.object({
    sessionId: z.string().cuid(),
    email: z.string().email(),
    role: z.nativeEnum(ParticipantRole).optional().default(ParticipantRole.VIEWER),
  }),
});

export const listInvitationsSchema = z.object({
  params: z.object({
    sessionId: z.string().cuid(),
  }),
});

export const acceptInvitationSchema = z.object({
  params: z.object({
    token: z.string().min(1),
  }),
  body: z.object({
    email: z.string().email().optional(),
  }),
});
