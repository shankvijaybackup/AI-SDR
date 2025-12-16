const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createUser() {
  try {
    // Hash the password
    const password = 'atomicwork123'; // Temporary password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create the user
    const user = await prisma.user.create({
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
    
    console.log('✅ User created successfully!');
    console.log('Email:', user.email);
    console.log('Temporary Password:', password);
    console.log('\nPlease login and change the password immediately.');
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('User already exists. Use password reset instead.');
    } else {
      console.error('Error:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
