"use server"
import 'server-only'

import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
import { enforceUserRetention } from '@elevate/storage'

const RetentionSchema = z.object({ userId: z.string(), days: z.number().int().min(1).max(3650).default(730) })

export async function enforceStorageRetentionService(body: unknown) {
  await requireRole('admin')
  const parsed = RetentionSchema.parse(body)
  const { userId, days } = parsed
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - Number(days))
  const deleted = await enforceUserRetention(userId, cutoff)
  return { userId, days, deleted }
}

