const { PrismaClient } = require('./packages/db/client');

async function testConnection() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
  
  const prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  });
  
  try {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Connection successful:', result);
    
    const users = await prisma.users.count();
    console.log('User count:', users);
  } catch (error) {
    console.error('Connection failed:', error.message);
    console.error('Error code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();