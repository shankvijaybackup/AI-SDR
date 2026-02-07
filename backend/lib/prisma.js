import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client to prevent connection pool exhaustion
// This ensures only one instance is created across the entire application

const globalForPrisma = global;

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
  console.log('[Prisma] ✅ Created new PrismaClient instance');
}

const prisma = globalForPrisma.prisma;

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  console.log('[Prisma] Disconnected');
});

export default prisma;
