'use server'

import { getSloSummaryService } from '@/lib/server/slo-service'

export type SLOSummary = {
  timestamp: string
  total_slos: number
  breaching_slos: number
  healthy_slos: number
  slos: Record<string, { current: number; target: number; threshold: number; trend: 'improving' | 'stable' | 'degrading'; breaching: boolean; description: string; metrics_count: number }>
}

export async function getSloSummaryAction(): Promise<SLOSummary> {
  const getSlo = getSloSummaryService as () => Promise<SLOSummary>
  return getSlo()
}
