import { metrics } from './metrics'
import { captureException as _captureException, captureMessage } from './sentry'

import type { LogContext } from './types'

/**
 * SLO (Service Level Objective) monitoring and alerting system
 */

interface SLODefinition {
  name: string
  description: string
  target: number // Target percentage (e.g., 99.9)
  window: number // Time window in milliseconds (e.g., 24 hours)
  threshold: number // Alert threshold percentage (e.g., 99.0 - alert when below this)
}

interface SLOMetric {
  timestamp: number
  success: boolean
  value?: number
  context?: LogContext
}

interface SLOStatus {
  slo: SLODefinition
  current: number
  trend: 'improving' | 'stable' | 'degrading'
  breaching: boolean
  lastBreach?: number
  metrics: SLOMetric[]
}

interface SLOSummaryEntry {
  current: number
  target: number
  threshold: number
  trend: 'improving' | 'stable' | 'degrading'
  breaching: boolean
  description: string
  metrics_count: number
}

interface SLOSummary {
  timestamp: string
  total_slos: number
  breaching_slos: number
  healthy_slos: number
  slos: Record<string, SLOSummaryEntry>
}

export class SLOMonitor {
  private static instance: SLOMonitor | undefined
  private slos: Map<string, SLODefinition> = new Map()
  private sloMetrics: Map<string, SLOMetric[]> = new Map()
  private alertCooldowns: Map<string, number> = new Map()
  
  static getInstance(): SLOMonitor {
    if (!SLOMonitor.instance) {
      SLOMonitor.instance = new SLOMonitor()
      // Initialize default SLOs
      SLOMonitor.instance.initializeDefaultSLOs()
    }
    return SLOMonitor.instance
  }

  /**
   * Initialize default SLOs for the platform
   */
  private initializeDefaultSLOs(): void {
    // API Response Time SLO
    this.defineSLO({
      name: 'api_response_time',
      description: 'API responses complete within 2 seconds',
      target: 99.5, // 99.5% of requests should be under 2s
      window: 24 * 60 * 60 * 1000, // 24 hours
      threshold: 98.0, // Alert if below 98%
    })

    // API Availability SLO
    this.defineSLO({
      name: 'api_availability',
      description: 'API availability (non-5xx responses)',
      target: 99.9, // 99.9% availability
      window: 24 * 60 * 60 * 1000, // 24 hours
      threshold: 99.0, // Alert if below 99%
    })

    // Database Operation Success SLO
    this.defineSLO({
      name: 'database_success_rate',
      description: 'Database operations succeed',
      target: 99.95, // 99.95% success rate
      window: 24 * 60 * 60 * 1000, // 24 hours
      threshold: 99.5, // Alert if below 99.5%
    })

    // Submission Processing SLO
    this.defineSLO({
      name: 'submission_processing_time',
      description: 'Submissions are processed within 48 hours',
      target: 95.0, // 95% processed within 48 hours
      window: 7 * 24 * 60 * 60 * 1000, // 1 week window
      threshold: 90.0, // Alert if below 90%
    })

    // User Authentication SLO
    this.defineSLO({
      name: 'auth_success_rate',
      description: 'User authentication succeeds',
      target: 99.8, // 99.8% success rate
      window: 24 * 60 * 60 * 1000, // 24 hours
      threshold: 99.0, // Alert if below 99%
    })
  }

  /**
   * Define a new SLO
   */
  defineSLO(slo: SLODefinition): void {
    this.slos.set(slo.name, slo)
    if (!this.sloMetrics.has(slo.name)) {
      this.sloMetrics.set(slo.name, [])
    }
  }

  /**
   * Record a metric for an SLO
   */
  recordMetric(sloName: string, success: boolean, value?: number, context?: LogContext): void {
    const sloMetrics = this.sloMetrics.get(sloName)
    if (!sloMetrics) {
      console.warn(`SLO '${sloName}' not found`)
      return
    }

    const metric: SLOMetric = {
      timestamp: Date.now(),
      success,
      ...(value !== undefined && { value }),
      ...(context && { context })
    }

    sloMetrics.push(metric)

    // Keep metrics within the window + 1 hour buffer
    const slo = this.slos.get(sloName)
    if (!slo) return
    
    const cutoff = Date.now() - slo.window - (60 * 60 * 1000)
    this.sloMetrics.set(
      sloName,
      sloMetrics.filter((m) => m.timestamp > cutoff)
    )

    // Check for SLO breach
    this.checkSLOBreach(sloName)

    // Update metrics
    metrics.incrementCounter('slo_metrics_recorded', {
      slo_name: sloName,
      success: success.toString(),
    })
  }

  /**
   * Record API response time metric
   */
  recordApiResponseTime(route: string, method: string, duration: number, statusCode: number): void {
    const success = duration < 2000 // Under 2 seconds
    this.recordMetric('api_response_time', success, duration, {
      route,
      method,
      status_code: statusCode.toString(),
    })
  }

  /**
   * Record API availability metric
   */
  recordApiAvailability(route: string, method: string, statusCode: number): void {
    const success = statusCode < 500
    this.recordMetric('api_availability', success, statusCode, {
      route,
      method,
    })
  }

  /**
   * Record database operation metric
   */
  recordDatabaseOperation(operation: string, table: string, success: boolean, duration: number): void {
    this.recordMetric('database_success_rate', success, duration, {
      operation,
      table,
    })
  }

  /**
   * Record submission processing metric
   */
  recordSubmissionProcessing(submissionId: string, success: boolean, processingTime: number): void {
    const success48h = processingTime < 48 * 60 * 60 * 1000 // Under 48 hours
    this.recordMetric('submission_processing_time', success && success48h, processingTime, {
      submission_id: submissionId,
    })
  }

  /**
   * Record authentication metric
   */
  recordAuthentication(success: boolean, provider?: string): void {
    this.recordMetric('auth_success_rate', success, undefined, {
      provider: provider || 'clerk',
    })
  }

  /**
   * Calculate current SLO status
   */
  getSLOStatus(sloName: string): SLOStatus | null {
    const slo = this.slos.get(sloName)
    const sloMetrics = this.sloMetrics.get(sloName)
    
    if (!slo || !sloMetrics) {
      return null
    }

    // Filter metrics within the window
    const now = Date.now()
    const windowStart = now - slo.window
    const windowMetrics = sloMetrics.filter((m) => m.timestamp >= windowStart)

    if (windowMetrics.length === 0) {
      return {
        slo,
        current: 100,
        trend: 'stable',
        breaching: false,
        metrics: [],
      }
    }

    // Calculate success rate
    const successCount = windowMetrics.filter((m) => m.success).length
    const current = (successCount / windowMetrics.length) * 100

    // Calculate trend (compare last hour vs previous hour)
    const hourAgo = now - (60 * 60 * 1000)
    const twoHoursAgo = now - (2 * 60 * 60 * 1000)
    
    const lastHourMetrics = windowMetrics.filter((m) => m.timestamp >= hourAgo)
    const previousHourMetrics = windowMetrics.filter((m) => m.timestamp >= twoHoursAgo && m.timestamp < hourAgo)
    
    const lastHourSuccess = lastHourMetrics.length > 0 
      ? (lastHourMetrics.filter((m) => m.success).length / lastHourMetrics.length) * 100 
      : current
    const previousHourSuccess = previousHourMetrics.length > 0 
      ? (previousHourMetrics.filter((m) => m.success).length / previousHourMetrics.length) * 100 
      : current

    let trend: 'improving' | 'stable' | 'degrading' = 'stable'
    if (Math.abs(lastHourSuccess - previousHourSuccess) > 1) {
      trend = lastHourSuccess > previousHourSuccess ? 'improving' : 'degrading'
    }

    // Check if breaching
    const breaching = current < slo.threshold

    return {
      slo,
      current,
      trend,
      breaching,
      ...(breaching && { lastBreach: now }),
      metrics: windowMetrics,
    }
  }

  /**
   * Check if an SLO is breaching and send alerts
   */
  private checkSLOBreach(sloName: string): void {
    const status = this.getSLOStatus(sloName)
    if (!status || !status.breaching) {
      return
    }

    // Check cooldown to avoid spam
    const lastAlert = this.alertCooldowns.get(sloName) || 0
    const cooldownPeriod = 30 * 60 * 1000 // 30 minutes
    
    if (Date.now() - lastAlert < cooldownPeriod) {
      return
    }

    // Send alert
    this.sendSLOAlert(status)
    this.alertCooldowns.set(sloName, Date.now())
  }

  /**
   * Send SLO breach alert
   */
  private sendSLOAlert(status: SLOStatus): void {
    const message = `SLO Breach: ${status.slo.name} is at ${status.current.toFixed(2)}% (threshold: ${status.slo.threshold}%)`
    
    // Log the alert
    console.error('SLO_BREACH_ALERT:', {
      slo_name: status.slo.name,
      current: status.current,
      target: status.slo.target,
      threshold: status.slo.threshold,
      trend: status.trend,
      description: status.slo.description,
    })

    // Send to Sentry
    captureMessage(message, 'warning', {
      slo_name: status.slo.name,
      current_slo: status.current,
      target_slo: status.slo.target,
      threshold: status.slo.threshold,
      trend: status.trend,
    })

    // Update metrics
    metrics.incrementCounter('slo_breaches_total', {
      slo_name: status.slo.name,
    })

    metrics.setGauge('slo_current_value', status.current, {
      slo_name: status.slo.name,
    })
  }

  /**
   * Get all SLO statuses
   */
  getAllSLOStatuses(): Record<string, SLOStatus | null> {
    const statuses: Record<string, SLOStatus | null> = {}
    
    for (const sloName of this.slos.keys()) {
      statuses[sloName] = this.getSLOStatus(sloName)
    }
    
    return statuses
  }

  /**
   * Get SLO summary for monitoring dashboards
   */
  getSLOSummary(): SLOSummary {
    const statuses = this.getAllSLOStatuses()
    const slos: Record<string, SLOSummaryEntry> = {}
    const summary: SLOSummary = {
      timestamp: new Date().toISOString(),
      total_slos: this.slos.size,
      breaching_slos: 0,
      healthy_slos: 0,
      slos,
    }

    for (const [name, status] of Object.entries(statuses)) {
      if (!status) continue

      if (status.breaching) {
        summary.breaching_slos++
      } else {
        summary.healthy_slos++
      }

      summary.slos[name] = {
        current: Number(status.current.toFixed(2)),
        target: status.slo.target,
        threshold: status.slo.threshold,
        trend: status.trend,
        breaching: status.breaching,
        description: status.slo.description,
        metrics_count: status.metrics.length,
      }
    }

    return summary
  }

  /**
   * Cleanup old metrics
   */
  cleanup(): void {
    const now = Date.now()
    
    for (const [sloName, slo] of this.slos) {
      const sloMetrics = this.sloMetrics.get(sloName) || []
      const cutoff = now - slo.window - (24 * 60 * 60 * 1000) // Keep extra day for analysis
      
      this.sloMetrics.set(
        sloName,
        sloMetrics.filter((m) => m.timestamp > cutoff)
      )
    }

    // Clear old alert cooldowns
    const cooldownCutoff = now - (60 * 60 * 1000) // 1 hour
    for (const [sloName, alertTime] of this.alertCooldowns) {
      if (alertTime < cooldownCutoff) {
        this.alertCooldowns.delete(sloName)
      }
    }
  }
}

// Export singleton instance
export const sloMonitor = SLOMonitor.getInstance()

// Export convenience functions
export const recordApiResponseTime = (route: string, method: string, duration: number, statusCode: number) =>
  sloMonitor.recordApiResponseTime(route, method, duration, statusCode)
  
export const recordApiAvailability = (route: string, method: string, statusCode: number) =>
  sloMonitor.recordApiAvailability(route, method, statusCode)
  
export const recordDatabaseOperation = (operation: string, table: string, success: boolean, duration: number) =>
  sloMonitor.recordDatabaseOperation(operation, table, success, duration)
  
export const recordSubmissionProcessing = (submissionId: string, success: boolean, processingTime: number) =>
  sloMonitor.recordSubmissionProcessing(submissionId, success, processingTime)
  
export const recordAuthentication = (success: boolean, provider?: string) =>
  sloMonitor.recordAuthentication(success, provider)
