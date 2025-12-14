// Metrics utility tests
// Tests helper functions for recording metrics

import {
  recordHttpRequest,
  recordWsConnection,
  recordWsMessage,
  recordAiRequest,
  recordDbQuery,
  recordError,
  httpRequestTotal,
  httpRequestDuration,
  wsConnectionsActive,
  wsConnectionsTotal,
  wsMessagesTotal,
  aiRequestsTotal,
  aiTokensUsed,
  aiCostTotal,
  aiRequestDuration,
  dbQueriesTotal,
  dbQueryDuration,
  errorsTotal,
} from '../../../utils/metrics';

describe('Metrics Helper Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordHttpRequest', () => {
    it('should increment http request counter and observe duration', () => {
      const incSpy = jest.spyOn(httpRequestTotal, 'inc');
      const observeSpy = jest.spyOn(httpRequestDuration, 'observe');

      recordHttpRequest('GET', '/api/users', 200, 0.15);

      expect(incSpy).toHaveBeenCalledWith({
        method: 'GET',
        route: '/api/users',
        status_code: 200,
      });
      expect(observeSpy).toHaveBeenCalledWith(
        { method: 'GET', route: '/api/users', status_code: 200 },
        0.15,
      );
    });

    it('should handle different status codes', () => {
      const incSpy = jest.spyOn(httpRequestTotal, 'inc');

      recordHttpRequest('POST', '/api/sessions', 201, 0.5);
      recordHttpRequest('GET', '/api/not-found', 404, 0.02);
      recordHttpRequest('POST', '/api/error', 500, 0.1);

      expect(incSpy).toHaveBeenCalledTimes(3);
      expect(incSpy).toHaveBeenCalledWith({
        method: 'POST',
        route: '/api/sessions',
        status_code: 201,
      });
      expect(incSpy).toHaveBeenCalledWith({
        method: 'GET',
        route: '/api/not-found',
        status_code: 404,
      });
      expect(incSpy).toHaveBeenCalledWith({
        method: 'POST',
        route: '/api/error',
        status_code: 500,
      });
    });
  });

  describe('recordWsConnection', () => {
    it('should increment active and total connections when connected', () => {
      const activeIncSpy = jest.spyOn(wsConnectionsActive, 'inc');
      const totalIncSpy = jest.spyOn(wsConnectionsTotal, 'inc');

      recordWsConnection('yjs', true);

      expect(activeIncSpy).toHaveBeenCalledWith({ type: 'yjs' });
      expect(totalIncSpy).toHaveBeenCalledWith({ type: 'yjs' });
    });

    it('should decrement active connections when disconnected', () => {
      const decSpy = jest.spyOn(wsConnectionsActive, 'dec');

      recordWsConnection('socketio', false);

      expect(decSpy).toHaveBeenCalledWith({ type: 'socketio' });
    });

    it('should handle different connection types', () => {
      const activeIncSpy = jest.spyOn(wsConnectionsActive, 'inc');

      recordWsConnection('yjs', true);
      recordWsConnection('socketio', true);

      expect(activeIncSpy).toHaveBeenCalledWith({ type: 'yjs' });
      expect(activeIncSpy).toHaveBeenCalledWith({ type: 'socketio' });
    });
  });

  describe('recordWsMessage', () => {
    it('should increment message counter for inbound messages', () => {
      const incSpy = jest.spyOn(wsMessagesTotal, 'inc');

      recordWsMessage('yjs', 'inbound');

      expect(incSpy).toHaveBeenCalledWith({ type: 'yjs', direction: 'inbound' });
    });

    it('should increment message counter for outbound messages', () => {
      const incSpy = jest.spyOn(wsMessagesTotal, 'inc');

      recordWsMessage('socketio', 'outbound');

      expect(incSpy).toHaveBeenCalledWith({ type: 'socketio', direction: 'outbound' });
    });
  });

  describe('recordAiRequest', () => {
    it('should record successful AI request with all metrics', () => {
      const requestsIncSpy = jest.spyOn(aiRequestsTotal, 'inc');
      const tokensIncSpy = jest.spyOn(aiTokensUsed, 'inc');
      const costIncSpy = jest.spyOn(aiCostTotal, 'inc');
      const durationObserveSpy = jest.spyOn(aiRequestDuration, 'observe');

      recordAiRequest('gpt-4', 'success', 1000, 0.03, 2.5);

      expect(requestsIncSpy).toHaveBeenCalledWith({ model: 'gpt-4', status: 'success' });
      expect(tokensIncSpy).toHaveBeenCalledWith({ model: 'gpt-4', user_id: 'aggregate' }, 1000);
      expect(costIncSpy).toHaveBeenCalledWith({ model: 'gpt-4' }, 0.03);
      expect(durationObserveSpy).toHaveBeenCalledWith({ model: 'gpt-4' }, 2.5);
    });

    it('should record failed AI request without tokens/cost', () => {
      const requestsIncSpy = jest.spyOn(aiRequestsTotal, 'inc');
      const tokensIncSpy = jest.spyOn(aiTokensUsed, 'inc');
      const costIncSpy = jest.spyOn(aiCostTotal, 'inc');
      const durationObserveSpy = jest.spyOn(aiRequestDuration, 'observe');

      recordAiRequest('gpt-3.5-turbo', 'error', 0, 0, 0.5);

      expect(requestsIncSpy).toHaveBeenCalledWith({ model: 'gpt-3.5-turbo', status: 'error' });
      expect(tokensIncSpy).not.toHaveBeenCalled();
      expect(costIncSpy).not.toHaveBeenCalled();
      expect(durationObserveSpy).toHaveBeenCalledWith({ model: 'gpt-3.5-turbo' }, 0.5);
    });
  });

  describe('recordDbQuery', () => {
    it('should record successful database query', () => {
      const queriesIncSpy = jest.spyOn(dbQueriesTotal, 'inc');
      const durationObserveSpy = jest.spyOn(dbQueryDuration, 'observe');

      recordDbQuery('findMany', 'User', 'success', 0.025);

      expect(queriesIncSpy).toHaveBeenCalledWith({
        operation: 'findMany',
        model: 'User',
        status: 'success',
      });
      expect(durationObserveSpy).toHaveBeenCalledWith(
        { operation: 'findMany', model: 'User' },
        0.025,
      );
    });

    it('should record failed database query without duration', () => {
      const queriesIncSpy = jest.spyOn(dbQueriesTotal, 'inc');
      const durationObserveSpy = jest.spyOn(dbQueryDuration, 'observe');

      recordDbQuery('create', 'Session', 'error', 0.1);

      expect(queriesIncSpy).toHaveBeenCalledWith({
        operation: 'create',
        model: 'Session',
        status: 'error',
      });
      expect(durationObserveSpy).not.toHaveBeenCalled();
    });

    it('should handle various operations', () => {
      const queriesIncSpy = jest.spyOn(dbQueriesTotal, 'inc');

      recordDbQuery('findUnique', 'User', 'success', 0.01);
      recordDbQuery('update', 'Session', 'success', 0.02);
      recordDbQuery('delete', 'File', 'success', 0.015);

      expect(queriesIncSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('recordError', () => {
    it('should increment error counter', () => {
      const incSpy = jest.spyOn(errorsTotal, 'inc');

      recordError('AuthenticationError', 'UNAUTHORIZED');

      expect(incSpy).toHaveBeenCalledWith({ type: 'AuthenticationError', code: 'UNAUTHORIZED' });
    });

    it('should handle different error types', () => {
      const incSpy = jest.spyOn(errorsTotal, 'inc');

      recordError('ValidationError', 'INVALID_INPUT');
      recordError('RateLimitError', 'TOO_MANY_REQUESTS');
      recordError('DatabaseError', 'CONNECTION_FAILED');

      expect(incSpy).toHaveBeenCalledTimes(3);
    });
  });
});
