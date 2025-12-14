// Invitation service tests
// Tests for session invitations

import { ParticipantRole } from '@prisma/client';
import { mockPrisma } from '../../setup';
import { NotFoundError, AuthorizationError, ValidationError } from '../../../utils/errors';
import invitationService, { InvitationService } from '../../../services/invitation.service';

// Mock notifications
jest.mock('../../../utils/notifications', () => ({
  sendNotification: jest.fn(),
}));

// Import crypto and spy on it
import crypto from 'crypto';
jest.spyOn(crypto, 'randomBytes').mockImplementation(
  () => Buffer.from('mocked-token-12345678901234567890123456789012') as any,
);

// Helper to create mock session
const createMockSession = (overrides: Partial<{
  id: string;
  name: string;
  description: string;
  owner_id: string;
  deleted_at: Date | null;
}> = {}) => ({
  id: 'session-123',
  name: 'Test Session',
  description: 'Test description',
  owner_id: 'owner-123',
  deleted_at: null,
  ...overrides,
});

// Helper to create mock invitation
const createMockInvitation = (overrides: Partial<{
  id: string;
  session_id: string;
  email: string;
  role: ParticipantRole;
  token: string;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
  session: { id: string; name: string; description: string; owner_id?: string };
}> = {}) => ({
  id: 'invitation-123',
  session_id: 'session-123',
  email: 'invited@example.com',
  role: 'EDITOR' as ParticipantRole,
  token: 'mocked-token-12345',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  accepted_at: null,
  created_at: new Date(),
  session: { id: 'session-123', name: 'Test Session', description: 'Test' },
  ...overrides,
});

// Helper to create mock participant
const createMockParticipant = (overrides: Partial<{
  id: string;
  session_id: string;
  user_id: string;
  role: string;
  left_at: Date | null;
}> = {}) => ({
  id: 'participant-123',
  session_id: 'session-123',
  user_id: 'user-123',
  role: 'EDITOR',
  left_at: null,
  ...overrides,
});

// Helper to create mock user
const createMockUser = (overrides: Partial<{
  id: string;
  email: string;
  name: string;
}> = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
});

describe('InvitationService', () => {
  let service: InvitationService;

  beforeEach(() => {
    service = new InvitationService();
    jest.clearAllMocks();
  });

  describe('createInvitation', () => {
    it('should create invitation as session owner', async () => {
      const mockSession = createMockSession({ owner_id: 'user-123' });
      const mockInvitation = createMockInvitation();
      const mockInviter = createMockUser({ id: 'user-123' });

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // No existing user with that email
        .mockResolvedValueOnce(mockInviter as any) // Inviter lookup
        .mockResolvedValueOnce(null); // Invited user lookup (doesn't exist)
      mockPrisma.sessionInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.sessionInvitation.create.mockResolvedValue(mockInvitation as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.createInvitation({
        sessionId: 'session-123',
        email: 'invited@example.com',
        role: 'EDITOR' as ParticipantRole,
        invitedBy: 'user-123',
      });

      expect(result).toEqual(mockInvitation);
      expect(mockPrisma.sessionInvitation.create).toHaveBeenCalled();
    });

    it('should create invitation as editor participant', async () => {
      const mockSession = createMockSession();
      const mockParticipant = createMockParticipant({ role: 'EDITOR' });
      const mockInvitation = createMockInvitation();
      const mockInviter = createMockUser({ id: 'user-123' });

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(mockParticipant as any);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockInviter as any)
        .mockResolvedValueOnce(null);
      mockPrisma.sessionInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.sessionInvitation.create.mockResolvedValue(mockInvitation as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.createInvitation({
        sessionId: 'session-123',
        email: 'invited@example.com',
        role: 'EDITOR' as ParticipantRole,
        invitedBy: 'user-123',
      });

      expect(result).toEqual(mockInvitation);
    });

    it('should throw NotFoundError when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        service.createInvitation({
          sessionId: 'non-existent',
          email: 'invited@example.com',
          role: 'EDITOR' as ParticipantRole,
          invitedBy: 'user-123',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user is not owner or editor', async () => {
      const mockSession = createMockSession();
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        service.createInvitation({
          sessionId: 'session-123',
          email: 'invited@example.com',
          role: 'EDITOR' as ParticipantRole,
          invitedBy: 'unauthorized-user',
        }),
      ).rejects.toThrow(AuthorizationError);
    });

    it('should throw ValidationError when user is already a participant', async () => {
      const mockSession = createMockSession({ owner_id: 'user-123' });
      const existingUser = createMockUser({ email: 'invited@example.com' });
      const existingParticipant = createMockParticipant();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique.mockResolvedValue(existingUser as any);
      mockPrisma.participant.findFirst.mockResolvedValue(existingParticipant as any);

      await expect(
        service.createInvitation({
          sessionId: 'session-123',
          email: 'invited@example.com',
          role: 'EDITOR' as ParticipantRole,
          invitedBy: 'user-123',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when pending invitation exists', async () => {
      const mockSession = createMockSession({ owner_id: 'user-123' });
      const existingInvitation = createMockInvitation();

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.sessionInvitation.findFirst.mockResolvedValue(existingInvitation as any);

      await expect(
        service.createInvitation({
          sessionId: 'session-123',
          email: 'invited@example.com',
          role: 'EDITOR' as ParticipantRole,
          invitedBy: 'user-123',
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('listInvitations', () => {
    it('should return invitations for session owner', async () => {
      const mockSession = createMockSession({ owner_id: 'user-123' });
      const mockInvitations = [createMockInvitation()];

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.sessionInvitation.findMany.mockResolvedValue(mockInvitations as any);

      const result = await service.listInvitations('session-123', 'user-123');

      expect(result).toEqual(mockInvitations);
    });

    it('should return invitations for participant', async () => {
      const mockSession = createMockSession();
      const mockParticipant = createMockParticipant();
      const mockInvitations = [createMockInvitation()];

      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(mockParticipant as any);
      mockPrisma.sessionInvitation.findMany.mockResolvedValue(mockInvitations as any);

      const result = await service.listInvitations('session-123', 'user-123');

      expect(result).toEqual(mockInvitations);
    });

    it('should throw NotFoundError when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(service.listInvitations('non-existent', 'user-123')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw AuthorizationError when user is not participant or owner', async () => {
      const mockSession = createMockSession();
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(service.listInvitations('session-123', 'unauthorized-user')).rejects.toThrow(
        AuthorizationError,
      );
    });
  });

  describe('acceptInvitation', () => {
    it('should accept invitation and create participant', async () => {
      const mockInvitation = createMockInvitation();
      const mockUser = createMockUser({ email: 'invited@example.com' });
      const mockParticipant = createMockParticipant();

      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.sessionInvitation.update.mockResolvedValue(mockInvitation as any);
      mockPrisma.participant.create.mockResolvedValue({
        ...mockParticipant,
        session: mockInvitation.session,
        user: mockUser,
      } as any);
      mockPrisma.session.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.acceptInvitation('mocked-token-12345', 'user-123');

      expect(result.success).toBe(true);
      expect(mockPrisma.participant.create).toHaveBeenCalled();
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: { participants_count: { increment: 1 } },
      });
    });

    it('should return requiresAuth when userId is not provided', async () => {
      const mockInvitation = createMockInvitation();
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);

      const result = await service.acceptInvitation('mocked-token-12345');

      expect(result.requiresAuth).toBe(true);
      expect(result.email).toBe('invited@example.com');
    });

    it('should throw NotFoundError when invitation not found', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(null);

      await expect(service.acceptInvitation('invalid-token', 'user-123')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw ValidationError when invitation already accepted', async () => {
      const mockInvitation = createMockInvitation({ accepted_at: new Date() });
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);

      await expect(service.acceptInvitation('mocked-token-12345', 'user-123')).rejects.toThrow(
        ValidationError,
      );
    });

    it('should throw ValidationError when invitation expired', async () => {
      const mockInvitation = createMockInvitation({
        expires_at: new Date(Date.now() - 1000),
      });
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);

      await expect(service.acceptInvitation('mocked-token-12345', 'user-123')).rejects.toThrow(
        ValidationError,
      );
    });

    it('should throw ValidationError when email does not match', async () => {
      const mockInvitation = createMockInvitation();
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);

      await expect(
        service.acceptInvitation('mocked-token-12345', undefined, 'different@example.com'),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw AuthorizationError when user email does not match invitation', async () => {
      const mockInvitation = createMockInvitation();
      const mockUser = createMockUser({ email: 'different@example.com' });

      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(service.acceptInvitation('mocked-token-12345', 'user-123')).rejects.toThrow(
        AuthorizationError,
      );
    });
  });

  describe('revokeInvitation', () => {
    it('should revoke invitation as session owner', async () => {
      const mockInvitation = createMockInvitation({
        session: { ...createMockSession(), owner_id: 'user-123' } as any,
      });

      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);
      mockPrisma.sessionInvitation.delete.mockResolvedValue(mockInvitation as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.revokeInvitation('invitation-123', 'user-123');

      expect(mockPrisma.sessionInvitation.delete).toHaveBeenCalledWith({
        where: { id: 'invitation-123' },
      });
    });

    it('should revoke invitation as editor participant', async () => {
      const mockInvitation = createMockInvitation();
      const mockParticipant = createMockParticipant({ role: 'EDITOR' });

      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);
      mockPrisma.participant.findFirst.mockResolvedValue(mockParticipant as any);
      mockPrisma.sessionInvitation.delete.mockResolvedValue(mockInvitation as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.revokeInvitation('invitation-123', 'user-123');

      expect(mockPrisma.sessionInvitation.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundError when invitation not found', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(null);

      await expect(service.revokeInvitation('non-existent', 'user-123')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw AuthorizationError when user is not owner or editor', async () => {
      const mockInvitation = createMockInvitation();
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(service.revokeInvitation('invitation-123', 'unauthorized-user')).rejects.toThrow(
        AuthorizationError,
      );
    });
  });

  describe('getInvitationByToken', () => {
    it('should return invitation by token', async () => {
      const mockInvitation = createMockInvitation();
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);

      const result = await service.getInvitationByToken('mocked-token-12345');

      expect(result).toEqual(mockInvitation);
    });

    it('should throw NotFoundError when invitation not found', async () => {
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(null);

      await expect(service.getInvitationByToken('invalid-token')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when invitation expired', async () => {
      const mockInvitation = createMockInvitation({
        expires_at: new Date(Date.now() - 1000),
      });
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);

      await expect(service.getInvitationByToken('mocked-token-12345')).rejects.toThrow(
        ValidationError,
      );
    });

    it('should throw ValidationError when invitation already accepted', async () => {
      const mockInvitation = createMockInvitation({ accepted_at: new Date() });
      mockPrisma.sessionInvitation.findUnique.mockResolvedValue(mockInvitation as any);

      await expect(service.getInvitationByToken('mocked-token-12345')).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('default export', () => {
    it('should export an InvitationService instance', () => {
      expect(invitationService).toBeInstanceOf(InvitationService);
    });
  });
});
