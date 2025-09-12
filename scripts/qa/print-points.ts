#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

async function main() {
  const user = process.env.USER_ID
  const event = process.env.EVENT_ID
  const where: any = {}
  if (user) where.user_id = user
  if (event) where.external_event_id = event

  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  const rows = await prisma.pointsLedger.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: 20,
    select: {
      user_id: true,
      activity_code: true,
      external_event_id: true,
      delta_points: true,
      source: true,
      external_source: true,
      event_time: true,
      created_at: true,
    },
  })
  console.log(rows)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
