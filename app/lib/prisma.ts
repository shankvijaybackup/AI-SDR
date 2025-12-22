import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  console.log('[Prisma] Creating new PrismaClient instance')
  console.log('[Prisma] DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...')

  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
    // Neon serverless connection settings
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

  // Log queries in development (reduce verbosity)
  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e: any) => {
      // Only log slow queries (>500ms) to reduce noise
      if (e.duration > 500) {
        console.log('[Prisma Slow Query]', e.query.substring(0, 100) + '...')
        console.log('[Prisma Duration]', e.duration + 'ms')
      }
    })
  }

  // Test connection with retry
  const connectWithRetry = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await client.$connect()
        console.log('[Prisma] ✅ Database connected successfully')
        return
      } catch (err: any) {
        console.error(`[Prisma] Connection attempt ${i + 1} failed:`, err.message)
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        }
      }
    }
    console.error('[Prisma] ❌ All connection attempts failed')
  }

  connectWithRetry()

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
