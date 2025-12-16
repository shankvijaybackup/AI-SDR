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
  })

  // Log queries in development
  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e: any) => {
      console.log('[Prisma Query]', e.query)
      console.log('[Prisma Params]', e.params)
      console.log('[Prisma Duration]', e.duration + 'ms')
    })
  }

  // Test connection
  client.$connect()
    .then(() => console.log('[Prisma] ✅ Database connected successfully'))
    .catch((err: any) => console.error('[Prisma] ❌ Connection error:', err))

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
