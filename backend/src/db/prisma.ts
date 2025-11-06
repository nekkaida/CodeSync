// Prisma client singleton
// Ensures single instance across application

import { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Connect on startup
prisma
  .$connect()
  .then(() => {
    log.info('✅ Database connected successfully');
  })
  .catch((error) => {
    log.error('❌ Database connection failed', error);
    process.exit(1);
  });

// Graceful disconnect
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  log.info('Database disconnected');
});

export default prisma;
