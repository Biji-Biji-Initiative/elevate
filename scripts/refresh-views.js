// Refresh materialized views using Prisma
import { prisma } from '@elevate/db/client'

async function main() {
  const views = [
    'leaderboard_totals',
    'leaderboard_30d',
    'metric_counts',
  ]

  for (const v of views) {
    try {
      // eslint-disable-next-line no-console
      console.log(`Refreshing materialized view: ${v}`)
      await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${v};`)
    } catch (e) {
      console.warn(`Failed to refresh ${v}:`, e?.message || e)
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
    // eslint-disable-next-line no-console
    console.log('Materialized views refresh complete')
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

