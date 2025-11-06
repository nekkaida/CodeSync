// Production-ready logger using Winston
// Structured logging with different transports for development and production

import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV === 'development';

// Custom format for development
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  }),
);

// Custom format for production (JSON)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: isDevelopment ? devFormat : prodFormat,
  defaultMeta: { service: 'codesync-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: isDevelopment ? devFormat : prodFormat,
    }),
  ],
});

// Add file transports in production
if (!isDevelopment) {
  const logDir = path.join(__dirname, '../../logs');

  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  );

  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  );
}

// Helper methods for common logging patterns
export const log = {
  info: (message: string, meta?: any) => logger.info(message, meta),
  error: (message: string, error?: Error | any, meta?: any) => {
    if (error instanceof Error) {
      logger.error(message, {
        error: error.message,
        stack: error.stack,
        ...meta,
      });
    } else {
      logger.error(message, { error, ...meta });
    }
  },
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  http: (message: string, meta?: any) => logger.http(message, meta),
};

// Express middleware for HTTP logging
export const httpLogger = (req: any, res: any, next: any) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl}`;

    log.http(message, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
};

export default logger;
