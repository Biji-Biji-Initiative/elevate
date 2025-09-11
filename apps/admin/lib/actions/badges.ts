'use server'

import { createBadgeService, updateBadgeService, deleteBadgeService, assignBadgeService, removeBadgeService, listBadgesService } from '@/lib/server/badges-service'
import type { AdminBadge } from '@elevate/types/admin-api-types'

export async function createBadgeAction(body: {
  code: string
  name: string
  description: string
  criteria: unknown
  icon_url?: string
}): Promise<{ message: string }>
{
  return createBadgeService(body)
}

export async function updateBadgeAction(body: {
  code: string
  name?: string
  description?: string
  criteria?: unknown
  icon_url?: string
}): Promise<{ message: string }>
{
  return updateBadgeService(body)
}

export async function deleteBadgeAction(code: string): Promise<{ message: string }>
{
  return deleteBadgeService(code)
}

export async function assignBadgeAction(body: { badgeCode: string; userIds: string[]; reason?: string })
  : Promise<{ message: string; processed?: number; failed?: number }>
{
  return assignBadgeService(body)
}

export async function removeBadgeAction(body: { badgeCode: string; userIds: string[]; reason?: string })
  : Promise<{ message: string; processed?: number; failed?: number }>
{
  return removeBadgeService(body)
}

export async function listBadgesAction(includeStats = true): Promise<{ badges: AdminBadge[] }>
{
  return listBadgesService(includeStats)
}
