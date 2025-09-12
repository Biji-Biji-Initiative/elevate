import type { SafeLogger } from './safe-server'

/**
 * Create a logger that automatically attaches { traceId } to the optional context argument.
 * It preserves the SafeLogger surface and forwards calls to the base logger.
 */
export function bindTrace(logger: SafeLogger, traceId?: string): SafeLogger {
  if (!traceId) return logger
  const methods: (keyof SafeLogger)[] = [
    'info','warn','error','debug','fatal','security','api','database','audit','performance','auth','webhook'
  ]
  const wrapped: Partial<SafeLogger> = {}
  for (const m of methods) {
    const fn = (logger as Record<string, unknown>)[m]
    if (typeof fn !== 'function') continue
    ;(wrapped as Record<string, unknown>)[m] = (...args: unknown[]) => {
      // If last arg is a plain object, merge traceId; else append context with traceId
      const last = args.length > 0 ? args[args.length - 1] : undefined
      if (last && typeof last === 'object' && !Array.isArray(last)) {
        const merged = { ...(last as Record<string, unknown>), traceId }
        const next = args.slice(0, -1)
        const methodFn = (logger as unknown as Record<string, (...a: unknown[]) => unknown>)[m]
        if (typeof methodFn === 'function') {
          methodFn(...next, merged)
        }
      } else {
        const methodFn = (logger as unknown as Record<string, (...a: unknown[]) => unknown>)[m]
        if (typeof methodFn === 'function') {
          methodFn(...args, { traceId })
        }
      }
    }
  }
  // Preserve optional forRequestWithHeaders if present
  if (typeof logger.forRequestWithHeaders === 'function') {
    wrapped.forRequestWithHeaders = (request: Request) => logger.forRequestWithHeaders!(request)
  }
  return wrapped as SafeLogger
}

/**
 * Extract a trace id from request headers using common header names.
 */
export function getTraceIdFromRequest(request: Request): string | undefined {
  try {
    const h = request.headers
    return (
      h.get('x-trace-id') ||
      h.get('X-Trace-Id') ||
      undefined
    )
  } catch {
    return undefined
  }
}

/**
 * Convenience helper to create a trace-bound logger for a request.
 */
export function createRequestLogger(logger: SafeLogger, request: Request): SafeLogger {
  const traceId = getTraceIdFromRequest(request)
  return bindTrace(logger, traceId)
}

