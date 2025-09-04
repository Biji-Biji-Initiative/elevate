// Core logger and types
// Default logger factory function
import type { LoggerConfig, LogContext } from './types'

export { Logger } from './logger'
export type * from './types'

// Configuration utilities
export {
  createLoggerConfig,
  getDefaultPinoConfig,
  parseLogLevel,
  parseRedactFields,
  parseBoolean,
  DEFAULT_REDACT_FIELDS,
} from './config'

// Utility functions
export {
  generateTraceId,
  generateRequestId,
  mergeContexts,
  serializeError,
  createTimer,
  endTimer,
  sanitizeLogData,
  extractRequestInfo,
  formatDuration,
  formatMemory,
  getMemoryUsage,
  getCpuUsage,
  createLogMeta,
} from './utils'

// Environment-specific exports
export type { ServerLogger } from './server'
export type { ClientLogger } from './client'

// Sentry integration
export {
  SentryIntegration,
  sentry,
  initSentry,
  captureException,
  captureMessage,
  addBreadcrumb,
  startTransaction,
  setSentryUser,
  setSentryTag,
  setSentryContext,
} from './sentry'

// Next.js middleware
export {
  withLogging,
  withApiLogging,
  withDatabaseLogging,
  getRequestLogData,
} from './next-middleware'

// Metrics collection
export {
  MetricsCollector,
  metrics,
  incrementCounter,
  recordHistogram,
  setGauge,
  trackSubmission,
  trackPointsAwarded,
  trackUserActivity,
  trackApiRequest,
  trackDatabaseOperation,
} from './metrics'

/**
 * Create a logger instance based on the environment
 */
export function createLogger(config?: Partial<LoggerConfig>, context?: LogContext) {
  // Check if we're in a Node.js environment
  if (typeof window === 'undefined' && typeof process !== 'undefined') {
    // Server environment - use ServerLogger
    return import('./server').then(({ createServerLogger }) => 
      createServerLogger(config, context)
    )
  } else {
    // Browser environment - use ClientLogger
    return import('./client').then(({ createClientLogger }) => 
      createClientLogger(config, context)
    )
  }
}

/**
 * Get the default logger instance based on environment
 */
export function getDefaultLogger(config?: Partial<LoggerConfig>) {
  if (typeof window === 'undefined' && typeof process !== 'undefined') {
    // Server environment
    return import('./server').then(({ getServerLogger }) => 
      getServerLogger(config)
    )
  } else {
    // Browser environment
    return import('./client').then(({ getClientLogger }) => 
      getClientLogger(config)
    )
  }
}
