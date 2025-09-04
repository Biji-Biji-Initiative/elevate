import crypto from 'node:crypto'
import type { ErrorInfo, LogContext, TimingData, CompletedTimingData } from './types.js'

/**
 * Generate a unique trace ID for request tracking
 */
export function generateTraceId(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return crypto.randomBytes(8).toString('hex')
}

/**
 * Create a child logger context by merging parent and child contexts
 */
export function mergeContexts(parent?: LogContext, child?: LogContext): LogContext {
  if (!parent && !child) return {}
  if (!parent) return child!
  if (!child) return parent

  return {
    ...parent,
    ...child,
    meta: {
      ...parent.meta,
      ...child.meta,
    },
  }
}

/**
 * Serialize an error object for logging
 */
export function serializeError(error: unknown, context?: LogContext): ErrorInfo {
  if (error instanceof Error) {
    const errorObj: ErrorInfo = {
      name: error.name,
      message: error.message,
      ...(error.stack && { stack: error.stack }),
      ...((error as any).code !== undefined && { code: (error as any).code }),
      ...((error as any).cause !== undefined && { cause: (error as any).cause }),
      ...(context && { context })
    }
    return errorObj
  }

  if (typeof error === 'string') {
    return {
      name: 'StringError',
      message: error,
      ...(context && { context })
    }
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as any
    return {
      name: obj.name || 'UnknownError',
      message: obj.message || String(error),
      ...(obj.stack && { stack: obj.stack }),
      ...(obj.code !== undefined && { code: obj.code }),
      ...(obj.cause !== undefined && { cause: obj.cause }),
      ...(context && { context })
    }
  }

  return {
    name: 'UnknownError',
    message: String(error),
    ...(context && { context })
  }
}

/**
 * Create a timing context for performance logging
 */
export function createTimer(): TimingData {
  return {
    startTime: Date.now(),
  }
}

/**
 * Complete a timing measurement
 */
export function endTimer(timer: TimingData): CompletedTimingData {
  const endTime = Date.now()
  return {
    ...timer,
    endTime,
    duration: endTime - timer.startTime,
  }
}

/**
 * Sanitize sensitive data from objects before logging
 */
export function sanitizeLogData(
  data: Record<string, unknown>,
  redactFields: string[] = []
): Record<string, unknown> {
  const sanitized = { ...data }

  for (const field of redactFields) {
    if (field.toLowerCase() in sanitized) {
      sanitized[field.toLowerCase()] = '[REDACTED]'
    }
    if (field.toUpperCase() in sanitized) {
      sanitized[field.toUpperCase()] = '[REDACTED]'
    }
  }

  return sanitized
}

/**
 * Extract request information for logging
 */
export function extractRequestInfo(request: Request): {
  method: string
  url: string
  userAgent?: string | undefined
  ip?: string | undefined
} {
  const userAgent = request.headers.get('user-agent')
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  
  return {
    method: request.method,
    url: request.url,
    userAgent: userAgent || undefined,
    ip: forwardedFor?.split(',')[0]?.trim() || realIp || undefined,
  }
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`
  }
  return `${(ms / 60000).toFixed(2)}m`
}

/**
 * Format memory usage in human-readable format
 */
export function formatMemory(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)}${units[unitIndex]}`
}

/**
 * Get current memory usage
 */
export function getMemoryUsage() {
  const usage = process.memoryUsage()
  return {
    used: usage.heapUsed,
    free: usage.heapTotal - usage.heapUsed,
    total: usage.heapTotal,
    rss: usage.rss,
    external: usage.external,
  }
}

/**
 * Get current CPU usage (simplified)
 */
export function getCpuUsage() {
  const usage = process.cpuUsage()
  return {
    user: usage.user,
    system: usage.system,
  }
}

/**
 * Create standardized log metadata
 */
export function createLogMeta(
  type: string,
  data: unknown = {},
  context?: LogContext
): Record<string, unknown> {
  return {
    type,
    timestamp: new Date().toISOString(),
    ...(data as Record<string, unknown>),
    ...(context && { context }),
  }
}