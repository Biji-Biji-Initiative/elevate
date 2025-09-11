"use server"
import 'server-only'

import { listKajabiService, kajabiHealthService } from '@/lib/server/kajabi-service'
import type { KajabiEvent, KajabiStats } from '@elevate/types/admin-api-types'

export type KajabiList = { events: KajabiEvent[]; stats: KajabiStats }

export async function getKajabiList(): Promise<KajabiList> {
  return listKajabiService()
}

export async function getKajabiHealth(): Promise<{ healthy: boolean; hasKey: boolean; hasSecret: boolean }> {
  return kajabiHealthService()
}
