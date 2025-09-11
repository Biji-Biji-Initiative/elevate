"use server"
import 'server-only'

import { prisma } from '@elevate/db'
import { AdminBadgeSchema, type AdminBadge } from '@elevate/types/admin-api-types'

type ListResult = { badges: AdminBadge[] }

export async function listBadges(includeStats = true): Promise<ListResult> {
  if (includeStats) {
    const rows = await prisma.badge.findMany({
      select: {
        code: true,
        name: true,
        description: true,
        criteria: true,
        icon_url: true,
        _count: { select: { earned_badges: true } },
      },
      orderBy: { code: 'asc' },
    })
    const badges: AdminBadge[] = rows.map((b) =>
      AdminBadgeSchema.parse({
        code: b.code,
        name: b.name,
        description: b.description,
        criteria: b.criteria,
        ...(b.icon_url ? { icon_url: b.icon_url } : {}),
        _count: { earned_badges: b._count.earned_badges },
      }),
    )
    return { badges }
  }

  const rows = await prisma.badge.findMany({
    select: { code: true, name: true, description: true, criteria: true, icon_url: true },
    orderBy: { code: 'asc' },
  })
  const badges: AdminBadge[] = rows.map((b) =>
    AdminBadgeSchema.parse({
      code: b.code,
      name: b.name,
      description: b.description,
      criteria: b.criteria,
      ...(b.icon_url ? { icon_url: b.icon_url } : {}),
    }),
  )
  return { badges }
}
