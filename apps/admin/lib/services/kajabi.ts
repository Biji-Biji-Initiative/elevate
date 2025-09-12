"use server"
import 'server-only'

import { listKajabiService, kajabiHealthService } from '@/lib/server/kajabi-service'
import type { KajabiEvent, KajabiStats } from '@elevate/types/admin-api-types'

export async function getKajabiList(): Promise<{ events: KajabiEvent[]; stats: KajabiStats }> {
  const svc = listKajabiService as unknown as () => Promise<{ events: KajabiEvent[]; stats: KajabiStats }>
  const out = await svc()
  return out
}

export async function getKajabiHealth(): Promise<{ healthy: boolean; hasKey: boolean; hasSecret: boolean }> {
  const svc = kajabiHealthService as unknown as () => Promise<{ healthy: boolean; hasKey: boolean; hasSecret: boolean }>
  const out = await svc()
  return out
}
