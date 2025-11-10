// Sentry error tracking integration
// Captures and reports errors to Sentry for monitoring

import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import { Express } from 'express';
import { log } from './logger';

export function initializeSentry(app: Express): void {
  const sentryDsn = process.env.SENTRY_DSN;

  if (!sentryDsn) {
    log.info('Sentry DSN not configured - error tracking disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      integrations: [
        // Enable HTTP request tracing
        new Sentry.Integrations.Http({ tracing: true }),
        // Enable Express request tracing
        new Tracing.Integrations.Express({ app }),
        // Enable PostgreSQL tracing
        new Tracing.Integrations.Postgres(),
        // Enable Redis tracing
        new Tracing.Integrations.Redis(),
      ],
      // Performance monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Release tracking
      release: process.env.GIT_COMMIT || 'unknown',
      // Ignore health check endpoints
      ignoreErrors: [
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
      ],
      beforeSend(event, hint) {
        // Don't send errors in development
        if (process.env.NODE_ENV === 'development') {
          return null;
        }

        // Filter sensitive data
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }

        return event;
      },
    });

    log.info('✅ Sentry error tracking initialized', {
      environment: process.env.NODE_ENV,
      sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
  } catch (error) {
    log.error('Failed to initialize Sentry', error);
  }
}

export function getSentryRequestHandler() {
  return Sentry.Handlers.requestHandler();
}

export function getSentryTracingHandler() {
  return Sentry.Handlers.tracingHandler();
}

export function getSentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture 4xx and 5xx errors
      return true;
    },
  });
}

export function captureSentryException(error: Error, context?: Record<string, any>): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

export function captureSentryMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
}

export { Sentry };
