import type { LogContext } from './types'

/**
 * Internal metrics collection for monitoring key business operations
 */

interface MetricValue {
  value: number
  timestamp: number
  labels: Record<string, string>
}

interface Counter {
  name: string
  help: string
  values: MetricValue[]
}

interface Histogram {
  name: string
  help: string
  buckets: number[]
  values: Array<{
    value: number
    timestamp: number
    labels: Record<string, string>
  }>
}

interface Gauge {
  name: string
  help: string
  value: number
  timestamp: number
  labels: Record<string, string>
}

interface CounterSummary {
  total: number
  recent_5m: number
}

interface HistogramSummary {
  count: number
  sum: number
  avg: number
  p50: number
  p95: number
  p99: number
}

interface GaugeSummary {
  value: number
  timestamp: number
  labels: Record<string, string>
}

interface MetricsSummary {
  timestamp: string
  uptime_seconds: number
  counters: Record<string, CounterSummary>
  histograms: Record<string, HistogramSummary>
  gauges: Record<string, GaugeSummary>
}

export class MetricsCollector {
  private static instance: MetricsCollector | undefined
  private counters: Map<string, Counter> = new Map()
  private histograms: Map<string, Histogram> = new Map()
  private gauges: Map<string, Gauge> = new Map()
  private startTime = Date.now()

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector()
    }
    return MetricsCollector.instance
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, {
        name,
        help: `Counter for ${name}`,
        values: [],
      })
    }

    const counter = this.counters.get(name)
    if (counter) {
      counter.values.push({
        value,
        timestamp: Date.now(),
        labels,
      })

      // Keep only last 1000 values to prevent memory leaks
      if (counter.values.length > 1000) {
        counter.values = counter.values.slice(-1000)
      }
    }
  }

  /**
   * Record a histogram value (for measuring durations/sizes)
   */
  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {},
    buckets: number[] = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
  ): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, {
        name,
        help: `Histogram for ${name}`,
        buckets,
        values: [],
      })
    }

    const histogram = this.histograms.get(name)
    if (histogram) {
      histogram.values.push({
        value,
        timestamp: Date.now(),
        labels,
      })

      // Keep only last 1000 values
      if (histogram.values.length > 1000) {
        histogram.values = histogram.values.slice(-1000)
      }
    }
  }

  /**
   * Set a gauge value (for measuring current state)
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    this.gauges.set(name, {
      name,
      help: `Gauge for ${name}`,
      value,
      timestamp: Date.now(),
      labels,
    })
  }

  /**
   * Business metric: Track LEAPS stage submissions
   */
  trackSubmission(stage: string, status: 'pending' | 'approved' | 'rejected', context?: LogContext): void {
    this.incrementCounter('leaps_submissions_total', {
      stage,
      status,
      user_id: context?.userId || 'unknown',
    })

    if (status === 'approved') {
      this.incrementCounter('leaps_approvals_total', { stage })
    } else if (status === 'rejected') {
      this.incrementCounter('leaps_rejections_total', { stage })
    }
  }

  /**
   * Business metric: Track points awarded
   */
  trackPointsAwarded(stage: string, points: number, context?: LogContext): void {
    this.incrementCounter('leaps_points_awarded_total', {
      stage,
      user_id: context?.userId || 'unknown',
    }, points)

    this.recordHistogram('leaps_points_distribution', points, { stage })
  }

  /**
   * Business metric: Track user activity
   */
  trackUserActivity(action: string, context?: LogContext): void {
    this.incrementCounter('user_activities_total', {
      action,
      user_id: context?.userId || 'unknown',
    })
  }

  /**
   * System metric: Track API requests
   */
  trackApiRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.incrementCounter('api_requests_total', {
      method,
      route,
      status_code: statusCode.toString(),
    })

    this.recordHistogram('api_request_duration_ms', duration, {
      method,
      route,
    })

    if (statusCode >= 400) {
      this.incrementCounter('api_errors_total', {
        method,
        route,
        status_code: statusCode.toString(),
      })
    }
  }

  /**
   * System metric: Track database operations
   */
  trackDatabaseOperation(operation: string, table: string, duration: number, success: boolean): void {
    this.incrementCounter('database_operations_total', {
      operation,
      table,
      success: success.toString(),
    })

    this.recordHistogram('database_operation_duration_ms', duration, {
      operation,
      table,
    })

    if (!success) {
      this.incrementCounter('database_errors_total', {
        operation,
        table,
      })
    }
  }

  /**
   * System metric: Track webhook processing
   */
  trackWebhookProcessing(provider: string, eventType: string, success: boolean, duration: number): void {
    this.incrementCounter('webhook_events_total', {
      provider,
      event_type: eventType,
      success: success.toString(),
    })

    this.recordHistogram('webhook_processing_duration_ms', duration, {
      provider,
      event_type: eventType,
    })

    if (!success) {
      this.incrementCounter('webhook_errors_total', {
        provider,
        event_type: eventType,
      })
    }
  }

  /**
   * System metric: Track authentication events
   */
  trackAuthentication(action: string, success: boolean, provider?: string): void {
    this.incrementCounter('auth_events_total', {
      action,
      success: success.toString(),
      provider: provider || 'unknown',
    })

    if (!success) {
      this.incrementCounter('auth_failures_total', {
        action,
        provider: provider || 'unknown',
      })
    }
  }

  /**
   * System metric: Update system health metrics
   */
  updateSystemHealth(memory: number, cpu: number): void {
    this.setGauge('system_memory_used_bytes', memory)
    this.setGauge('system_cpu_usage_percent', cpu)
    this.setGauge('system_uptime_seconds', (Date.now() - this.startTime) / 1000)
  }

  /**
   * Get all metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = []

    // Counters
    for (const counter of this.counters.values()) {
      lines.push(`# HELP ${counter.name} ${counter.help}`)
      lines.push(`# TYPE ${counter.name} counter`)
      
      const totals = new Map<string, number>()
      
      counter.values.forEach((value) => {
        const labelStr = Object.entries(value.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',')
        const key = labelStr ? `{${labelStr}}` : ''
        totals.set(key, (totals.get(key) || 0) + value.value)
      })

      for (const [labels, total] of totals) {
        lines.push(`${counter.name}${labels} ${total}`)
      }
    }

    // Histograms
    for (const histogram of this.histograms.values()) {
      lines.push(`# HELP ${histogram.name} ${histogram.help}`)
      lines.push(`# TYPE ${histogram.name} histogram`)
      
      const bucketMap = new Map<string, { count: number; sum: number }>()
      
      histogram.values.forEach((value) => {
        const labelStr = Object.entries(value.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',')
        const baseKey = labelStr ? `{${labelStr}}` : ''
        
        if (!bucketMap.has(baseKey)) {
          bucketMap.set(baseKey, { count: 0, sum: 0 })
        }
        
        const bucket = bucketMap.get(baseKey)
        if (bucket) {
          bucket.count++
          bucket.sum += value.value
        }
      })

      for (const [labels, bucket] of bucketMap) {
        lines.push(`${histogram.name}_count${labels} ${bucket.count}`)
        lines.push(`${histogram.name}_sum${labels} ${bucket.sum}`)
      }
    }

    // Gauges
    for (const gauge of this.gauges.values()) {
      lines.push(`# HELP ${gauge.name} ${gauge.help}`)
      lines.push(`# TYPE ${gauge.name} gauge`)
      
      const labelStr = Object.entries(gauge.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')
      const key = labelStr ? `{${labelStr}}` : ''
      
      lines.push(`${gauge.name}${key} ${gauge.value}`)
    }

    return lines.join('\n') + '\n'
  }

  /**
   * Get metrics summary for JSON API
   */
  getMetricsSummary(): MetricsSummary {
    const summary: MetricsSummary = {
      timestamp: new Date().toISOString(),
      uptime_seconds: (Date.now() - this.startTime) / 1000,
      counters: {},
      histograms: {},
      gauges: {},
    }

    // Counter summaries
    for (const [name, counter] of this.counters) {
      summary.counters[name] = {
        total: counter.values.reduce((sum, v) => sum + v.value, 0),
        recent_5m: counter.values
          .filter((v) => Date.now() - v.timestamp < 5 * 60 * 1000)
          .reduce((sum, v) => sum + v.value, 0),
      }
    }

    // Histogram summaries
    for (const [name, histogram] of this.histograms) {
      const values = histogram.values.map((v) => v.value).sort((a, b) => a - b)
      summary.histograms[name] = {
        count: values.length,
        sum: values.reduce((sum, v) => sum + v, 0),
        avg: values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0,
        p50: values[Math.floor(values.length * 0.5)] || 0,
        p95: values[Math.floor(values.length * 0.95)] || 0,
        p99: values[Math.floor(values.length * 0.99)] || 0,
      }
    }

    // Gauge values
    for (const [name, gauge] of this.gauges) {
      summary.gauges[name] = {
        value: gauge.value,
        timestamp: gauge.timestamp,
        labels: gauge.labels,
      }
    }

    return summary
  }

  /**
   * Clear old metrics data
   */
  cleanup(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24 hours

    for (const counter of this.counters.values()) {
      counter.values = counter.values.filter((v) => v.timestamp > cutoff)
    }

    for (const histogram of this.histograms.values()) {
      histogram.values = histogram.values.filter((v) => v.timestamp > cutoff)
    }

    // Keep gauges as they represent current state
  }
}

// Export singleton instance
export const metrics = MetricsCollector.getInstance()

// Export convenience functions
export const incrementCounter = (name: string, labels?: Record<string, string>, value?: number) =>
  metrics.incrementCounter(name, labels, value)
  
export const recordHistogram = (name: string, value: number, labels?: Record<string, string>) =>
  metrics.recordHistogram(name, value, labels)
  
export const setGauge = (name: string, value: number, labels?: Record<string, string>) =>
  metrics.setGauge(name, value, labels)

export const trackSubmission = (stage: string, status: 'pending' | 'approved' | 'rejected', context?: LogContext) =>
  metrics.trackSubmission(stage, status, context)
  
export const trackPointsAwarded = (stage: string, points: number, context?: LogContext) =>
  metrics.trackPointsAwarded(stage, points, context)
  
export const trackUserActivity = (action: string, context?: LogContext) =>
  metrics.trackUserActivity(action, context)
  
export const trackApiRequest = (method: string, route: string, statusCode: number, duration: number) =>
  metrics.trackApiRequest(method, route, statusCode, duration)
  
export const trackDatabaseOperation = (operation: string, table: string, duration: number, success: boolean) =>
  metrics.trackDatabaseOperation(operation, table, duration, success)
