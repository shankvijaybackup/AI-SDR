const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createUser() {
  try {
    // Use Render database URL
    const renderDbUrl = 'postgresql://neondb_owner:npg_d40qbEBPceyg@ep-still-breeze-a4ms76zx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
    
    // Create new Prisma client with Render DB
    const renderPrisma = new PrismaClient({
      datasources: {
        db: {
          url: renderDbUrl
        }
      }
    });
    
    // Check if user exists
    const existingUser = await renderPrisma.user.findUnique({
      where: { email: 'vijay@atomicwork.com' }
    });
    
    if (existingUser) {
      console.log('User already exists in Render database');
      console.log('Active status:', existingUser.isActive);
      
      if (!existingUser.isActive) {
        await renderPrisma.user.update({
          where: { email: 'vijay@atomicwork.com' },
          data: { isActive: true, isEmailVerified: true }
        });
        console.log('✅ User activated in Render database!');
      }
    } else {
      // Hash the password
      const password = 'atomicwork123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create the user
      const user = await renderPrisma.user.create({
        data: {
          email: 'vijay@atomicwork.com',
          password: hashedPassword,
          firstName: 'Vijay',
          lastName: 'Shankar',
          company: 'Atomicwork',
          role: 'ADMIN',
          isActive: true,
          isEmailVerified: true
        }
      });
      
      console.log('✅ User created in Render database!');
      console.log('Email:', user.email);
      console.log('Password:', password);
    }
    
    await renderPrisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
