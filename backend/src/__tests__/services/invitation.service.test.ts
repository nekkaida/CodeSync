// Invitation service tests
// Tests for session invitation functionality

import { mockPrisma } from '../setup';
import { InvitationService } from '../../services/invitation.service';
import { NotFoundError, AuthorizationError, ValidationError } from '../../utils/errors';

// Mock the email service
jest.mock('../../services/email.service', () => ({
  __esModule: true,
  default: {
    sendInvitation: jest.fn().mockResolvedValue(true),
  },
}));

// Mock notifications
jest.mock('../../utils/notifications', () => ({
  sendNotification: jest.fn(),
}));

// Create fresh instance for testing
const invitationService = new InvitationService();

describe('InvitationService', () => {
  const mockSession = {
    id: 'session-1',
    name: 'Test Session',
    description: 'A test session',
    language: 'typescript',
    visibility: 'PRIVATE',
    status: 'ACTIVE',
    owner_id: 'owner-1',
    deleted_at: null,
    deleted_by: null,
    last_activity: new Date(),
    participants_count: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockInvitation = {
    id: 'invite-1',
    session_id: 'session-1',
    email: 'invited@example.com',
    role: 'EDITOR' as const,
    token: 'abc123token',
    accepted_at: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    created_at: new Date(),
    session: {
      id: 'session-1',
      name: 'Test Session',
      description: 'A test session',
    },
  };

  const mockUser = {
    id: 'user-1',
    email: 'invited@example.com',
    name: 'Invited User',
    role: 'USER' as const,
    password: 'hashed',
    deleted_at: null,
    deleted_by: null,
    ai_cost_limit: 10.0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  describe('createInvitation', () => {
    it('should create an invitation as session owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // existing user check
        .mockResolvedValueOnce({ id: 'owner-1', name: 'Owner' } as any); // inviter
      mockPrisma.sessionInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.sessionInvitation.create.mockResolvedValue(mockInvitation as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await invitationService.createInvitation({
        sessionId: 'session-1',
        email: 'invited@example.com',
        role: 'EDITOR' as any,
        invitedBy: 'owner-1',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.sessionInvitation.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should create invitation as editor', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'different-owner',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue({
        id: 'participant-1',
        role: 'EDITOR',
      } as any);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // existing user check
        .mockResolvedValueOnce({ id: 'editor-1', name: 'Editor' } as any); // inviter
      mockPrisma.sessionInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.sessionInvitation.create.mockResolvedValue(mockInvitation as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await invitationService.createInvitation({
        sessionId: 'session-1',
        email: 'invited@example.com',
        role: 'VIEWER' as any,
        invitedBy: 'editor-1',
      });

      expect(result).toBeDefined();
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        invitationService.createInvitation({
          sessionId: 'non-existent',
          email: 'test@example.com',
          role: 'VIEWER' as any,
          invitedBy: 'user-1',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError for deleted session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        deleted_at: new Date(),
      } as any);

      await expect(
        invitationService.createInvitation({
          sessionId: 'session-1',
          email: 'test@example.com',
          role: 'VIEWER' as any,
          invitedBy: 'owner-1',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError for non-editor/owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'different-owner',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        invitationService.createInvitation({
          sessionId: 'session-1',
          email: 'test@example.com',
          role: 'VIEWER' as any,
          invitedBy: 'viewer-1',
        }),
      ).rejects.toThrow(AuthorizationError);
    });

    it('should throw ValidationError if user is already participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.participant.findFirst.mockResolvedValue({ id: 'participant-1' } as any);

      await expect(
        invitationService.createInvitation({
          sessionId: 'session-1',
          email: 'invited@example.com',
          role: 'VIEWER' as any,
          invitedBy: 'owner-1',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if pending invitation exists', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.sessionInvitation.findFirst.mockResolvedValue(mockInvitation as any);

      await expect(
        invitationService.createInvitation({
          sessionId: 'session-1',
          email: 'invited@example.com',
          role: 'VIEWER' as any,
          invitedBy: 'owner-1',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should send notification to existing user', async () => {
      const { sendNotification } = require('../../utils/notifications');

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // existing user check for participant
        .mockResolvedValueOnce({ id: 'owner-1', name: 'Owner' } as any) // inviter
        .mockResolvedValueOnce({ id: 'invited-user-1' } as any); // invited user exists
      mockPrisma.sessionInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.sessionInvitation.create.mockResolvedValue(mockInvitation as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await invitationService.createInvitation({
        sessionId: 'session-1',
        email: 'invited@example.com',
        role: 'EDITOR' as any,
        invitedBy: 'owner-1',
      });

      expect(sendNotification).toHaveBeenCalledWith(
        'invited-user-1',
        expect.objectContaining({
          type: 'invitation',
          title: 'New Session Invitation',
        }),
      );
    });
  });

  describe('listInvitations', () => {
    it('should list invitations for session owner', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.sessionInvitation.findMany.mockResolvedValue([mockInvitation] as any);

      const result = await invitationService.listInvitations('session-1', 'owner-1');

      expect(result).toHaveLength(1);
    });

    it('should list invitations for session participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'different-owner',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue({ id: 'participant-1' } as any);
      mockPrisma.sessionInvitation.findMany.mockResolvedValue([mockInvitation] as any);

      const result = await invitationService.listInvitations('session-1', 'participant-1');

      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        invitationService.listInvitations('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError for non-participant', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        owner_id: 'different-owner',
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        invitationService.listInvitations('session-1', 'outsider'),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('acceptInvitation', () => {
    it('should accept invitation and add participant', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.sessionInvitation.update.mockResolvedValue({} as any);
      mockPrisma.participant.create.mockResolvedValue({
        ...mockUser,
        session: mockSession,
      } as any);
      mockPrisma.session.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await invitationService.acceptInvitation(
        'abc123token',
        'user-1',
        'invited@example.com',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.participant.create).toHaveBeenCalled();
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { participants_count: { increment: 1 } },
      });
    });

    it('should return requiresAuth when userId not provided', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);

      const result = await invitationService.acceptInvitation('abc123token');

      expect(result.requiresAuth).toBe(true);
      expect(result.email).toBe('invited@example.com');
    });

    it('should throw NotFoundError for invalid token', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(null);

      await expect(
        invitationService.acceptInvitation('invalid-token', 'user-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for already accepted invitation', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        accepted_at: new Date(),
      } as any);

      await expect(
        invitationService.acceptInvitation('abc123token', 'user-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for expired invitation', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        expires_at: new Date(Date.now() - 1000), // Expired
      } as any);

      await expect(
        invitationService.acceptInvitation('abc123token', 'user-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when email does not match', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);

      await expect(
        invitationService.acceptInvitation('abc123token', 'user-1', 'wrong@email.com'),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw AuthorizationError when user email does not match invitation', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        email: 'different@email.com',
      } as any);

      await expect(
        invitationService.acceptInvitation('abc123token', 'user-1'),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('revokeInvitation', () => {
    it('should revoke invitation as session owner', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        session: mockSession,
      } as any);
      mockPrisma.sessionInvitation.delete.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await invitationService.revokeInvitation('invite-1', 'owner-1');

      expect(mockPrisma.sessionInvitation.delete).toHaveBeenCalledWith({
        where: { id: 'invite-1' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should revoke invitation as editor', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        session: { ...mockSession, owner_id: 'different-owner' },
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue({ id: 'p1', role: 'EDITOR' } as any);
      mockPrisma.sessionInvitation.delete.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await invitationService.revokeInvitation('invite-1', 'editor-1');

      expect(mockPrisma.sessionInvitation.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent invitation', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(null);

      await expect(
        invitationService.revokeInvitation('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError for non-editor/owner', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        session: { ...mockSession, owner_id: 'different-owner' },
      } as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        invitationService.revokeInvitation('invite-1', 'viewer-1'),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('getInvitationByToken', () => {
    it('should get invitation by token', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        session: {
          ...mockSession,
          owner: { name: 'Owner' },
        },
      } as any);

      const result = await invitationService.getInvitationByToken('abc123token');

      expect(result).toBeDefined();
      expect(result.token).toBe('abc123token');
    });

    it('should throw NotFoundError for invalid token', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(null);

      await expect(
        invitationService.getInvitationByToken('invalid-token'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for expired invitation', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        expires_at: new Date(Date.now() - 1000),
      } as any);

      await expect(
        invitationService.getInvitationByToken('abc123token'),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for already accepted invitation', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        accepted_at: new Date(),
      } as any);

      await expect(
        invitationService.getInvitationByToken('abc123token'),
      ).rejects.toThrow(ValidationError);
    });
  });
});
