import { sloMonitor } from '@elevate/logging/slo-monitor'

/**
 * Records availability and response time for a service route.
 * - route: logical route key, e.g. "/admin/service/badges/list"
 * - startMs: timestamp captured at start (Date.now())
 * - status: HTTP-like status code to reflect success/failure in metrics (default 200)
 */
export function recordSLO(route: string, startMs: number, status = 200) {
  sloMonitor.recordApiAvailability(route, 'SERVICE', status)
  sloMonitor.recordApiResponseTime(route, 'SERVICE', Date.now() - startMs, status)
}

