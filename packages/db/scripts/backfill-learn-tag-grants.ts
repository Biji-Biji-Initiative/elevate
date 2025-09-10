#!/usr/bin/env tsx
/*
 * Backfill learn_tag_grants from Kajabi events.
 * - Dry-run by default: prints planned inserts.
 * - Use --apply to write changes.
 * - Optional flags: --limit N --offset M
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Args = {
  apply: boolean
  limit: number
  offset: number
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let apply = false
  let limit = 1000
  let offset = 0
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--apply') apply = true
    else if (a === '--limit') limit = Number(args[++i] || '1000')
    else if (a === '--offset') offset = Number(args[++i] || '0')
  }
  return { apply, limit, offset }
}

async function main() {
  const { apply, limit, offset } = parseArgs()
  const tags = ['elevate-ai-1-completed', 'elevate-ai-2-completed']

  console.log(`Backfill learn_tag_grants (dry-run=${!apply}) limit=${limit} offset=${offset}`)

  // Fetch tagged Kajabi events window
  const events = await prisma.kajabiEvent.findMany({
    where: { tag_name_norm: { in: tags } },
    orderBy: { created_at_utc: 'asc' },
    take: limit,
    skip: offset,
  })

  let planned = 0
  let applied = 0
  for (const evt of events) {
    if (!evt.email) continue
    const user = await prisma.user.findFirst({ where: { email: evt.email }, select: { id: true } })
    if (!user) continue

    // Check if grant exists
    const exists = await prisma.learnTagGrant.findUnique({
      where: { user_id_tag_name: { user_id: user.id, tag_name: evt.tag_name_norm } },
    })
    if (exists) continue

    planned++
    console.log(`[PLAN] Grant ${evt.tag_name_norm} -> ${user.id} (${evt.email}) @ ${evt.created_at_utc.toISOString()}`)

    if (apply) {
      await prisma.learnTagGrant.create({
        data: { user_id: user.id, tag_name: evt.tag_name_norm, granted_at: evt.created_at_utc },
      })
      applied++
    }
  }

  console.log(`Backfill complete. Planned=${planned} Applied=${applied}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

