"use server"
import 'server-only'

import { sloMonitor } from '@elevate/logging/slo-monitor'

export async function getSloSummaryService() {
  return sloMonitor.getSLOSummary()
}

export async function getSloStatusService(slo: string) {
  return sloMonitor.getSLOStatus(slo)
}

