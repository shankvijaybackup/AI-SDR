const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'vijay@atomicwork.com' }
    });
    
    if (user) {
      console.log('User found:');
      console.log('Email:', user.email);
      console.log('First Name:', user.firstName);
      console.log('Last Name:', user.lastName);
      console.log('Company:', user.company);
      console.log('Role:', user.role);
      console.log('Created At:', user.createdAt);
      console.log('\nPassword hash:', user.password);
      console.log('\nNote: Password is hashed with bcrypt. To login, you need to use password reset or set a new password.');
    } else {
      console.log('User vijay@atomicwork.com not found in database');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
