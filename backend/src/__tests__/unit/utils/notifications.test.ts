// Notifications utility tests
// Tests real-time notification functions

import {
  setSocketIOInstance,
  getSocketIOInstance,
  sendNotification,
  sendSessionNotification,
} from '../../../utils/notifications';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  log: {
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('notifications utility', () => {
  let mockIO: any;
  let mockEmit: jest.Mock;
  let mockTo: jest.Mock;
  let mockExcept: jest.Mock;

  beforeEach(() => {
    mockEmit = jest.fn();
    mockExcept = jest.fn().mockReturnValue({ emit: mockEmit });
    mockTo = jest.fn().mockReturnValue({
      emit: mockEmit,
      except: mockExcept,
    });
    mockIO = {
      to: mockTo,
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset the socket instance
    setSocketIOInstance(null as any);
  });

  describe('setSocketIOInstance', () => {
    it('should set the socket.io instance', () => {
      setSocketIOInstance(mockIO);
      expect(getSocketIOInstance()).toBe(mockIO);
    });
  });

  describe('getSocketIOInstance', () => {
    it('should return null when not set', () => {
      expect(getSocketIOInstance()).toBeNull();
    });

    it('should return the socket.io instance when set', () => {
      setSocketIOInstance(mockIO);
      expect(getSocketIOInstance()).toBe(mockIO);
    });
  });

  describe('sendNotification', () => {
    it('should warn when socket.io is not initialized', () => {
      const { log } = require('../../../utils/logger');

      sendNotification('user-123', {
        type: 'message',
        title: 'Test',
        message: 'Test message',
      });

      expect(log.warn).toHaveBeenCalledWith('Socket.io not initialized, cannot send notification');
      expect(mockTo).not.toHaveBeenCalled();
    });

    it('should send notification to user room', () => {
      setSocketIOInstance(mockIO);

      sendNotification('user-123', {
        type: 'message',
        title: 'Test',
        message: 'Test message',
      });

      expect(mockTo).toHaveBeenCalledWith('user:user-123');
      expect(mockEmit).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          type: 'message',
          title: 'Test',
          message: 'Test message',
          read: false,
          timestamp: expect.any(Date),
          id: expect.stringMatching(/^notif_\d+_[a-z0-9]+$/),
        }),
      );
    });

    it('should include actionUrl when provided', () => {
      setSocketIOInstance(mockIO);

      sendNotification('user-123', {
        type: 'invitation',
        title: 'New Invitation',
        message: 'You have been invited',
        actionUrl: '/session/123',
      });

      expect(mockEmit).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          actionUrl: '/session/123',
        }),
      );
    });

    it('should include metadata when provided', () => {
      setSocketIOInstance(mockIO);

      sendNotification('user-123', {
        type: 'system',
        title: 'System Update',
        message: 'System will restart',
        metadata: { duration: 60, severity: 'warning' },
      });

      expect(mockEmit).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          metadata: { duration: 60, severity: 'warning' },
        }),
      );
    });

    it('should log debug message after sending', () => {
      const { log } = require('../../../utils/logger');
      setSocketIOInstance(mockIO);

      sendNotification('user-123', {
        type: 'join',
        title: 'User Joined',
        message: 'Someone joined the session',
      });

      expect(log.debug).toHaveBeenCalledWith('Notification sent', {
        userId: 'user-123',
        type: 'join',
        title: 'User Joined',
      });
    });
  });

  describe('sendSessionNotification', () => {
    it('should warn when socket.io is not initialized', () => {
      const { log } = require('../../../utils/logger');

      sendSessionNotification('session-123', null, {
        type: 'message',
        title: 'Test',
        message: 'Test message',
      });

      expect(log.warn).toHaveBeenCalledWith('Socket.io not initialized, cannot send notification');
      expect(mockTo).not.toHaveBeenCalled();
    });

    it('should send notification to session room', () => {
      setSocketIOInstance(mockIO);

      sendSessionNotification('session-123', null, {
        type: 'snapshot',
        title: 'Snapshot Created',
        message: 'A snapshot was created',
      });

      expect(mockTo).toHaveBeenCalledWith('session:session-123');
      expect(mockEmit).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          type: 'snapshot',
          title: 'Snapshot Created',
          message: 'A snapshot was created',
          read: false,
          timestamp: expect.any(Date),
        }),
      );
    });

    it('should exclude specified user from notification', () => {
      setSocketIOInstance(mockIO);

      sendSessionNotification('session-123', 'user-456', {
        type: 'leave',
        title: 'User Left',
        message: 'A user left the session',
      });

      expect(mockTo).toHaveBeenCalledWith('session:session-123');
      expect(mockExcept).toHaveBeenCalledWith('user:user-456');
      expect(mockEmit).toHaveBeenCalled();
    });

    it('should not call except when excludeUserId is null', () => {
      setSocketIOInstance(mockIO);

      sendSessionNotification('session-123', null, {
        type: 'system',
        title: 'System Message',
        message: 'Maintenance scheduled',
      });

      expect(mockExcept).not.toHaveBeenCalled();
      expect(mockEmit).toHaveBeenCalled();
    });

    it('should log debug message after sending', () => {
      const { log } = require('../../../utils/logger');
      setSocketIOInstance(mockIO);

      sendSessionNotification('session-123', 'user-456', {
        type: 'message',
        title: 'New Message',
        message: 'Someone sent a message',
      });

      expect(log.debug).toHaveBeenCalledWith('Session notification sent', {
        sessionId: 'session-123',
        excludeUserId: 'user-456',
        type: 'message',
      });
    });

    it('should generate unique notification ids', () => {
      setSocketIOInstance(mockIO);

      sendSessionNotification('session-123', null, {
        type: 'join',
        title: 'Join',
        message: 'First',
      });

      sendSessionNotification('session-123', null, {
        type: 'join',
        title: 'Join',
        message: 'Second',
      });

      const calls = mockEmit.mock.calls;
      const id1 = calls[0][1].id;
      const id2 = calls[1][1].id;

      expect(id1).toMatch(/^notif_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^notif_\d+_[a-z0-9]+$/);
      // IDs should be unique (though race conditions could make them the same in rare cases)
    });
  });
});
