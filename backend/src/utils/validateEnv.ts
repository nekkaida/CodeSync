// Environment variable validation
// Ensures all required environment variables are set on startup

import { log } from './logger';

interface EnvVarConfig {
  name: string;
  required: boolean;
  default?: string;
  validate?: (value: string) => boolean;
  description: string;
}

const ENV_VARS: EnvVarConfig[] = [
  // Server Configuration
  {
    name: 'NODE_ENV',
    required: false,
    default: 'development',
    validate: (v) => ['development', 'production', 'test'].includes(v),
    description: 'Application environment',
  },
  {
    name: 'PORT',
    required: false,
    default: '4000',
    validate: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0,
    description: 'HTTP server port',
  },
  {
    name: 'YJS_PORT',
    required: false,
    default: '4001',
    validate: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0,
    description: 'Yjs WebSocket server port',
  },

  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    validate: (v) => v.startsWith('postgresql://'),
    description: 'PostgreSQL connection string',
  },

  // Redis
  {
    name: 'REDIS_URL',
    required: true,
    validate: (v) => v.startsWith('redis://'),
    description: 'Redis connection string',
  },

  // Security Secrets
  {
    name: 'JWT_SECRET',
    required: true,
    validate: (v) => v.length >= 32,
    description: 'JWT signing secret (min 32 characters)',
  },
  {
    name: 'CSRF_SECRET',
    required: true,
    validate: (v) => v.length >= 32,
    description: 'CSRF token secret (min 32 characters)',
  },
  {
    name: 'SESSION_SECRET',
    required: true,
    validate: (v) => v.length >= 32,
    description: 'Session secret (min 32 characters)',
  },

  // CORS
  {
    name: 'ALLOWED_ORIGINS',
    required: false,
    default: 'http://localhost:3000',
    description: 'Comma-separated list of allowed origins',
  },

  // S3/MinIO Storage
  {
    name: 'S3_ENDPOINT',
    required: true,
    description: 'S3/MinIO endpoint hostname',
  },
  {
    name: 'S3_PORT',
    required: false,
    default: '9000',
    validate: (v) => !isNaN(parseInt(v)),
    description: 'S3/MinIO port',
  },
  {
    name: 'S3_ACCESS_KEY',
    required: true,
    description: 'S3/MinIO access key',
  },
  {
    name: 'S3_SECRET_KEY',
    required: true,
    validate: (v) => v.length >= 8,
    description: 'S3/MinIO secret key',
  },
  {
    name: 'S3_BUCKET',
    required: false,
    default: 'codesync-files',
    description: 'S3/MinIO bucket name',
  },
  {
    name: 'S3_USE_SSL',
    required: false,
    default: 'false',
    validate: (v) => ['true', 'false'].includes(v),
    description: 'Use SSL for S3/MinIO',
  },

  // SMTP (Optional for email)
  {
    name: 'SMTP_HOST',
    required: false,
    description: 'SMTP server hostname',
  },
  {
    name: 'SMTP_PORT',
    required: false,
    validate: (v) => !v || !isNaN(parseInt(v)),
    description: 'SMTP server port',
  },
  {
    name: 'SMTP_USER',
    required: false,
    description: 'SMTP username',
  },
  {
    name: 'SMTP_PASS',
    required: false,
    description: 'SMTP password',
  },
  {
    name: 'SMTP_FROM',
    required: false,
    description: 'Email from address',
  },
  {
    name: 'SMTP_FROM_NAME',
    required: false,
    default: 'CodeSync',
    description: 'Email from name',
  },

  // Frontend URL
  {
    name: 'FRONTEND_URL',
    required: false,
    default: 'http://localhost:3000',
    validate: (v) => v.startsWith('http://') || v.startsWith('https://'),
    description: 'Frontend application URL',
  },

  // Monitoring (Optional)
  {
    name: 'SENTRY_DSN',
    required: false,
    description: 'Sentry DSN for error tracking',
  },
  {
    name: 'LOG_LEVEL',
    required: false,
    default: 'info',
    validate: (v) => ['error', 'warn', 'info', 'debug'].includes(v),
    description: 'Logging level',
  },
];

export function validateEnv(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  log.info('Validating environment variables...');

  for (const config of ENV_VARS) {
    const value = process.env[config.name];

    // Check if required variable is missing
    if (config.required && !value) {
      errors.push(`Missing required environment variable: ${config.name}`);
      errors.push(`  Description: ${config.description}`);
      continue;
    }

    // Set default value if not provided
    if (!value && config.default) {
      process.env[config.name] = config.default;
      info.push(`Using default for ${config.name}: ${config.default}`);
      continue;
    }

    // Skip validation if not set and not required
    if (!value) {
      if (!config.required) {
        warnings.push(`Optional variable not set: ${config.name}`);
        warnings.push(`  Description: ${config.description}`);
      }
      continue;
    }

    // Validate value if validator provided
    if (config.validate && !config.validate(value)) {
      errors.push(`Invalid value for ${config.name}: ${value}`);
      errors.push(`  Description: ${config.description}`);
    }
  }

  // Log results
  if (info.length > 0) {
    info.forEach((msg) => log.info(msg));
  }

  if (warnings.length > 0) {
    log.warn('Environment variable warnings:');
    warnings.forEach((msg) => log.warn(`  ${msg}`));
  }

  if (errors.length > 0) {
    log.error('Environment variable validation failed:');
    errors.forEach((msg) => log.error(`  ${msg}`));
    log.error('\nPlease check your .env file and ensure all required variables are set.');
    log.error('See .env.example for reference.\n');
    process.exit(1);
  }

  log.info('✅ Environment variables validated successfully');
}

export function printEnvSummary(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = process.env.PORT || '4000';
  const yjsPort = process.env.YJS_PORT || '4001';
  const dbUrl = process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@') || 'NOT SET';
  const redisUrl = process.env.REDIS_URL?.replace(/:[^:@]+@/, ':****@') || 'NOT SET';

  log.info('\n' + '='.repeat(60));
  log.info('CodeSync Backend Configuration');
  log.info('='.repeat(60));
  log.info(`Environment:     ${nodeEnv}`);
  log.info(`HTTP Port:       ${port}`);
  log.info(`YJS Port:        ${yjsPort}`);
  log.info(`Database:        ${dbUrl}`);
  log.info(`Redis:           ${redisUrl}`);
  log.info(`S3 Endpoint:     ${process.env.S3_ENDPOINT}:${process.env.S3_PORT || 9000}`);
  log.info(`S3 Bucket:       ${process.env.S3_BUCKET || 'codesync-files'}`);
  log.info(`Frontend URL:    ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  log.info(`SMTP Configured: ${process.env.SMTP_HOST ? 'Yes' : 'No'}`);
  log.info(`Sentry:          ${process.env.SENTRY_DSN ? 'Enabled' : 'Disabled'}`);
  log.info('='.repeat(60) + '\n');
}
