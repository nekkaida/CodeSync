// Prometheus metrics for monitoring
// Tracks HTTP requests, WebSocket connections, Yjs operations, and system health

import client from 'prom-client';

// Enable default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ prefix: 'codesync_' });

// Create a Registry
export const register = new client.Registry();

// Add default metrics to registry
client.collectDefaultMetrics({ register });

// HTTP Metrics
export const httpRequestDuration = new client.Histogram({
  name: 'codesync_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: 'codesync_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// WebSocket Metrics
export const wsConnectionsActive = new client.Gauge({
  name: 'codesync_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['type'], // 'yjs' or 'socketio'
  registers: [register],
});

export const wsConnectionsTotal = new client.Counter({
  name: 'codesync_websocket_connections_total',
  help: 'Total number of WebSocket connections',
  labelNames: ['type'],
  registers: [register],
});

export const wsMessagesTotal = new client.Counter({
  name: 'codesync_websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['type', 'direction'], // direction: 'inbound' or 'outbound'
  registers: [register],
});

// Yjs-specific Metrics
export const yjsDocumentsActive = new client.Gauge({
  name: 'codesync_yjs_documents_active',
  help: 'Number of active Yjs documents',
  registers: [register],
});

export const yjsOperationsTotal = new client.Counter({
  name: 'codesync_yjs_operations_total',
  help: 'Total number of Yjs operations',
  labelNames: ['operation_type'],
  registers: [register],
});

export const yjsSyncDuration = new client.Histogram({
  name: 'codesync_yjs_sync_duration_seconds',
  help: 'Duration of Yjs sync operations',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// Session Metrics
export const sessionsActive = new client.Gauge({
  name: 'codesync_sessions_active',
  help: 'Number of active coding sessions',
  registers: [register],
});

export const sessionParticipants = new client.Gauge({
  name: 'codesync_session_participants',
  help: 'Number of participants in sessions',
  labelNames: ['session_id'],
  registers: [register],
});

// AI Metrics
export const aiRequestsTotal = new client.Counter({
  name: 'codesync_ai_requests_total',
  help: 'Total number of AI requests',
  labelNames: ['model', 'status'], // status: 'success' or 'error'
  registers: [register],
});

export const aiTokensUsed = new client.Counter({
  name: 'codesync_ai_tokens_used_total',
  help: 'Total number of AI tokens used',
  labelNames: ['model', 'user_id'],
  registers: [register],
});

export const aiCostTotal = new client.Counter({
  name: 'codesync_ai_cost_usd_total',
  help: 'Total AI cost in USD',
  labelNames: ['model'],
  registers: [register],
});

export const aiRequestDuration = new client.Histogram({
  name: 'codesync_ai_request_duration_seconds',
  help: 'Duration of AI requests',
  labelNames: ['model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Database Metrics
export const dbQueryDuration = new client.Histogram({
  name: 'codesync_db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const dbQueriesTotal = new client.Counter({
  name: 'codesync_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'model', 'status'],
  registers: [register],
});

// Rate Limiting Metrics
export const rateLimitHits = new client.Counter({
  name: 'codesync_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['type', 'user_id'], // type: 'ai', 'api', 'ws'
  registers: [register],
});

// Error Metrics
export const errorsTotal = new client.Counter({
  name: 'codesync_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code'],
  registers: [register],
});

// Helper functions
export const recordHttpRequest = (
  method: string,
  route: string,
  statusCode: number,
  duration: number,
) => {
  httpRequestTotal.inc({ method, route, status_code: statusCode });
  httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
};

export const recordWsConnection = (type: 'yjs' | 'socketio', connected: boolean) => {
  if (connected) {
    wsConnectionsActive.inc({ type });
    wsConnectionsTotal.inc({ type });
  } else {
    wsConnectionsActive.dec({ type });
  }
};

export const recordWsMessage = (type: 'yjs' | 'socketio', direction: 'inbound' | 'outbound') => {
  wsMessagesTotal.inc({ type, direction });
};

export const recordAiRequest = (
  model: string,
  status: 'success' | 'error',
  tokens: number,
  cost: number,
  duration: number,
) => {
  aiRequestsTotal.inc({ model, status });
  if (status === 'success') {
    aiTokensUsed.inc({ model, user_id: 'aggregate' }, tokens);
    aiCostTotal.inc({ model }, cost);
  }
  aiRequestDuration.observe({ model }, duration);
};

export const recordDbQuery = (
  operation: string,
  model: string,
  status: 'success' | 'error',
  duration: number,
) => {
  dbQueriesTotal.inc({ operation, model, status });
  if (status === 'success') {
    dbQueryDuration.observe({ operation, model }, duration);
  }
};

export const recordError = (type: string, code: string) => {
  errorsTotal.inc({ type, code });
};
