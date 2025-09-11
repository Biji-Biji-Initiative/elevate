"use server"
import 'server-only'

import { prisma, getPublicProfileByHandle } from '@elevate/db'
import { mapRawUserProfileToDTO, type UserProfileDTO } from '@elevate/types/dto-mappers'

export async function getPublicProfileByHandleService(handle: string): Promise<UserProfileDTO | null> {
  const user = await getPublicProfileByHandle(handle)
  if (!user) return null
  const pointsAgg = await prisma.pointsLedger.aggregate({
    _sum: { delta_points: true },
    where: { user_id: user.id },
  })
  const total = pointsAgg._sum.delta_points || 0
  const raw = {
    id: user.id,
    handle: user.handle,
    name: user.name,
    school: user.school ?? null,
    cohort: user.cohort ?? null,
    created_at: user.created_at,
    _sum: { points: total },
    earned_badges: user.earned_badges.map((eb) => ({
      badge_code: eb.badge_code,
      badge: {
        code: eb.badge.code,
        name: eb.badge.name,
        description: eb.badge.description,
        icon_url: eb.badge.icon_url ?? null,
      },
      earned_at: eb.earned_at,
    })),
    submissions: user.submissions.map((s) => ({
      id: s.id,
      activity_code: s.activity_code,
      activity: { name: s.activity?.name ?? s.activity_code, code: s.activity?.code ?? s.activity_code },
      status: s.status,
      visibility: s.visibility,
      payload: (s.payload ?? {}) as Record<string, unknown>,
      created_at: s.created_at,
      updated_at: s.updated_at ?? s.created_at,
    })),
  }
  return mapRawUserProfileToDTO(raw)
}

