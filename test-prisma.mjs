import { prisma } from './packages/db/client.js'

async function main() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL)
  try {
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('Query successful:', result)
  } catch (error) {
    console.error('Error:', error.message)
    console.error('Full error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()