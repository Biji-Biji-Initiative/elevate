"use server"
import 'server-only'

import { z } from 'zod'

import { sloMonitor } from '@elevate/logging/slo-monitor'

type Trend = 'improving' | 'stable' | 'degrading'
export type SLOSummary = {
  timestamp: string
  total_slos: number
  breaching_slos: number
  healthy_slos: number
  slos: Record<string, { current: number; target: number; threshold: number; trend: Trend; breaching: boolean; description: string; metrics_count: number }>
}

export async function getSloSummary(slo?: string): Promise<SLOSummary> {
  const Trend = z.union([z.literal('improving'), z.literal('stable'), z.literal('degrading')])
  const Slo = z.object({ current: z.number(), target: z.number(), threshold: z.number(), trend: Trend, breaching: z.boolean(), description: z.string(), metrics_count: z.number().int() })
  const Summary = z.object({ timestamp: z.string(), total_slos: z.number().int(), breaching_slos: z.number().int(), healthy_slos: z.number().int(), slos: z.record(Slo) })
  const data = slo ? sloMonitor.getSLOStatus(slo) : sloMonitor.getSLOSummary()
  const parsed = Summary.safeParse(data)
  if (!parsed.success) throw new Error('Invalid SLO data')
  return parsed.data as SLOSummary
}
