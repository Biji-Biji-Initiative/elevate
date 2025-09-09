/* Dev utility to test Prisma connectivity locally */
const { PrismaClient } = require('../../packages/db/client');
const logger = require('../utils/logger');

async function testConnection() {
  logger.info({ url: (process.env.DATABASE_URL || '').toString().slice(0, 50) + '...' }, 'DATABASE_URL')

  const prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

  try {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    logger.info({ result }, 'Connection successful')

    const users = await prisma.users.count();
    logger.info({ users }, 'User count')
  } catch (error) {
    logger.error({ err: error }, 'Connection failed')
    if (error && error.code) logger.error({ code: error.code }, 'Error code')
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
