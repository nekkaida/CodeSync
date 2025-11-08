// Invitation service
// Handles session invitations

import { PrismaClient, ParticipantRole } from '@prisma/client';
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/errors';
import { log } from '../utils/logger';
import { sendNotification } from '../utils/notifications';
import emailService from './email.service';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface CreateInvitationInput {
  sessionId: string;
  email: string;
  role: ParticipantRole;
  invitedBy: string;
}

export class InvitationService {
  // Create invitation
  async createInvitation(input: CreateInvitationInput) {
    const { sessionId, email, role, invitedBy } = input;

    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    // Check if user is owner or editor
    if (session.owner_id !== invitedBy) {
      const participant = await prisma.participant.findFirst({
        where: {
          session_id: sessionId,
          user_id: invitedBy,
          role: { in: ['OWNER', 'EDITOR'] },
          left_at: null,
        },
      });

      if (!participant) {
        throw new AuthorizationError('Only session owner or editors can invite users');
      }
    }

    // Check if user is already a participant
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const existingParticipant = await prisma.participant.findFirst({
        where: {
          session_id: sessionId,
          user_id: existingUser.id,
          left_at: null,
        },
      });

      if (existingParticipant) {
        throw new ValidationError('User is already a participant in this session');
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.sessionInvitation.findFirst({
      where: {
        session_id: sessionId,
        email,
        accepted_at: null,
        expires_at: {
          gt: new Date(),
        },
      },
    });

    if (existingInvitation) {
      throw new ValidationError('An invitation has already been sent to this email');
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.sessionInvitation.create({
      data: {
        session_id: sessionId,
        email,
        role,
        token,
        expires_at: expiresAt,
      },
      include: {
        session: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: invitedBy,
        action: 'CREATE',
        resource_type: 'invitation',
        resource_id: invitation.id,
        details: JSON.stringify({ email, role, sessionId }),
      },
    });

    log.info('Invitation created', { invitationId: invitation.id, email, sessionId });

    // Get inviter name for email
    const inviter = await prisma.user.findUnique({
      where: { id: invitedBy },
      select: { name: true },
    });

    // Send email notification
    await emailService.sendInvitation(
      email,
      inviter?.name || 'A user',
      invitation.session.name,
      invitation.token,
    );

    // Check if invited user exists and send real-time notification
    const invitedUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (invitedUser) {
      sendNotification(invitedUser.id, {
        type: 'invitation',
        title: 'New Session Invitation',
        message: `You've been invited to collaborate on "${invitation.session.name}"`,
        actionUrl: `/invite/${invitation.token}`,
        metadata: {
          sessionId: invitation.session_id,
          sessionName: invitation.session.name,
          role,
        },
      });
    }

    return invitation;
  }

  // List invitations for a session
  async listInvitations(sessionId: string, userId: string) {
    // Check if session exists and user has access
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    if (session.owner_id !== userId) {
      const participant = await prisma.participant.findFirst({
        where: {
          session_id: sessionId,
          user_id: userId,
          left_at: null,
        },
      });

      if (!participant) {
        throw new AuthorizationError('Not authorized to view invitations');
      }
    }

    const invitations = await prisma.sessionInvitation.findMany({
      where: {
        session_id: sessionId,
        accepted_at: null,
        expires_at: {
          gt: new Date(),
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return invitations;
  }

  // Accept invitation
  async acceptInvitation(token: string, userId?: string, email?: string) {
    const invitation = await prisma.sessionInvitation.findUnique({
      where: { token },
      include: {
        session: true,
      },
    });

    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    if (invitation.accepted_at) {
      throw new ValidationError('Invitation has already been accepted');
    }

    if (invitation.expires_at < new Date()) {
      throw new ValidationError('Invitation has expired');
    }

    // Check if email matches (for logged-in users)
    if (email && invitation.email !== email) {
      throw new ValidationError('Invitation email does not match');
    }

    // If user is not logged in, they need to register/login first
    if (!userId) {
      return {
        requiresAuth: true,
        email: invitation.email,
        sessionName: invitation.session.name,
        token,
      };
    }

    // Verify user email matches invitation
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.email !== invitation.email) {
      throw new AuthorizationError('Invitation is for a different email address');
    }

    // Mark invitation as accepted
    await prisma.sessionInvitation.update({
      where: { id: invitation.id },
      data: {
        accepted_at: new Date(),
      },
    });

    // Add user as participant
    const participant = await prisma.participant.create({
      data: {
        session_id: invitation.session_id,
        user_id: userId,
        role: invitation.role,
      },
      include: {
        session: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update session participants count
    await prisma.session.update({
      where: { id: invitation.session_id },
      data: {
        participants_count: {
          increment: 1,
        },
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'JOIN',
        resource_type: 'session',
        resource_id: invitation.session_id,
        details: JSON.stringify({ via: 'invitation', role: invitation.role }),
      },
    });

    log.info('Invitation accepted', {
      invitationId: invitation.id,
      userId,
      sessionId: invitation.session_id,
    });

    return {
      success: true,
      participant,
      session: invitation.session,
    };
  }

  // Revoke invitation
  async revokeInvitation(invitationId: string, userId: string) {
    const invitation = await prisma.sessionInvitation.findUnique({
      where: { id: invitationId },
      include: {
        session: true,
      },
    });

    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    // Check if user is owner or editor
    if (invitation.session.owner_id !== userId) {
      const participant = await prisma.participant.findFirst({
        where: {
          session_id: invitation.session_id,
          user_id: userId,
          role: { in: ['OWNER', 'EDITOR'] },
          left_at: null,
        },
      });

      if (!participant) {
        throw new AuthorizationError('Not authorized to revoke invitations');
      }
    }

    // Delete invitation
    await prisma.sessionInvitation.delete({
      where: { id: invitationId },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'DELETE',
        resource_type: 'invitation',
        resource_id: invitationId,
        details: JSON.stringify({ email: invitation.email }),
      },
    });

    log.info('Invitation revoked', { invitationId, userId });
  }

  // Get invitation by token (public)
  async getInvitationByToken(token: string) {
    const invitation = await prisma.sessionInvitation.findUnique({
      where: { token },
      include: {
        session: {
          select: {
            id: true,
            name: true,
            description: true,
            language: true,
            owner: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    if (invitation.expires_at < new Date()) {
      throw new ValidationError('Invitation has expired');
    }

    if (invitation.accepted_at) {
      throw new ValidationError('Invitation has already been accepted');
    }

    return invitation;
  }
}

export default new InvitationService();
