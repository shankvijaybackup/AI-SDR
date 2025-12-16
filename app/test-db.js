const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
})

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...')
    
    // Test connection
    await prisma.$connect()
    console.log('✅ Connected to database')
    
    // Test query
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Query executed:', result)
    
    // Check if User table exists
    const userCount = await prisma.user.count()
    console.log(`✅ User table exists. Current count: ${userCount}`)
    
    // Test creating a user
    console.log('\n🔍 Testing user creation...')
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: '$2a$12$test.hash.here',
        firstName: 'Test',
        lastName: 'User',
      },
    })
    console.log('✅ User created:', testUser.id)
    
    // Clean up test user
    await prisma.user.delete({
      where: { id: testUser.id },
    })
    console.log('✅ Test user deleted')
    
    console.log('\n🎉 All database tests passed!')
    
  } catch (error) {
    console.error('❌ Database test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
