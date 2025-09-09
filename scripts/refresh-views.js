// Refresh materialized views using Prisma
import { Prisma } from '@prisma/client'

import { prisma } from '@elevate/db/client'

async function main() {
  try {
     
    console.log('Refreshing materialized view: leaderboard_totals')
    await prisma.$executeRaw(Prisma.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_totals`)
  } catch (e) {
    console.warn('Failed to refresh leaderboard_totals:', e?.message || e)
  }

  try {
     
    console.log('Refreshing materialized view: leaderboard_30d')
    await prisma.$executeRaw(Prisma.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_30d`)
  } catch (e) {
    console.warn('Failed to refresh leaderboard_30d:', e?.message || e)
  }

  try {
     
    console.log('Refreshing materialized view: metric_counts')
    await prisma.$executeRaw(Prisma.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY metric_counts`)
  } catch (e) {
    console.warn('Failed to refresh metric_counts:', e?.message || e)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
     
    console.log('Materialized views refresh complete')
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
