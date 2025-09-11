'use server'

import { testKajabiService, reprocessKajabiService, inviteKajabiService, listKajabiService, kajabiHealthService } from '@/lib/server/kajabi-service'
import type { KajabiEvent, KajabiStats } from '@elevate/types/admin-api-types'

export async function testKajabiAction(body: { user_email: string; course_name?: string })
  : Promise<{ success: boolean; message?: string; test_mode?: boolean; [k: string]: unknown }>
{
  return testKajabiService(body)
}

export async function reprocessKajabiAction(body: { event_id: string }): Promise<{ message: string }>
{
  return reprocessKajabiService(body) as Promise<{ message: string }>
}

export async function inviteKajabiAction(body: { userId?: string; email?: string; name?: string; offerId?: string | number })
  : Promise<{ invited: boolean; contactId?: number; withOffer: boolean }>
{
  const res = await inviteKajabiService(body)
  const out: { invited: boolean; contactId?: number; withOffer: boolean } = { invited: res.invited, withOffer: res.withOffer }
  if (res.contactId !== undefined) out.contactId = res.contactId
  return out
}

export async function listKajabiAction(): Promise<{ events: KajabiEvent[]; stats: KajabiStats }>
{
  return listKajabiService()
}

export async function kajabiHealthAction(): Promise<{ healthy: boolean; hasKey: boolean; hasSecret: boolean }>
{
  return kajabiHealthService()
}
