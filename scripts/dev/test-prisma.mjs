/* Dev utility to ping Prisma using ESM */
import { prisma } from '../../packages/db/client.js'
import { logger } from '../utils/logger.mjs'

async function main() {
  logger.info({ url: process.env.DATABASE_URL }, 'DATABASE_URL')
  try {
    const result = await prisma.$queryRaw`SELECT 1 as test`
    logger.info({ result }, 'Query successful')
  } catch (error) {
    logger.error({ err: error }, 'Error running Prisma test')
  } finally {
    await prisma.$disconnect()
  }
}

main()
