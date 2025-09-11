'use server'

import { enforceStorageRetentionService } from '@/lib/server/storage-service'

export async function enforceStorageRetentionAction(body: { userId: string; days?: number })
  : Promise<{ userId: string; days: number; deleted: number }>
{
  return enforceStorageRetentionService(body)
}
