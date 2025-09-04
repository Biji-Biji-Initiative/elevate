// Core logger and types
export { Logger } from './logger.js'
export type * from './types.js'

// Configuration utilities
export {
  createLoggerConfig,
  getDefaultPinoConfig,
  parseLogLevel,
  parseRedactFields,
  parseBoolean,
  DEFAULT_REDACT_FIELDS,
} from './config.js'

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
} from './utils.js'

// Environment-specific exports
export type { ServerLogger } from './server.js'
export type { ClientLogger } from './client.js'

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
} from './sentry.js'

// Next.js middleware
export {
  withLogging,
  withApiLogging,
  withDatabaseLogging,
  getRequestLogData,
} from './next-middleware.js'

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
} from './metrics.js'

// Default logger factory function
import type { LoggerConfig, LogContext } from './types.js'

/**
 * Create a logger instance based on the environment
 */
export function createLogger(config?: Partial<LoggerConfig>, context?: LogContext) {
  // Check if we're in a Node.js environment
  if (typeof window === 'undefined' && typeof process !== 'undefined') {
    // Server environment - use ServerLogger
    return import('./server.js').then(({ createServerLogger }) => 
      createServerLogger(config, context)
    )
  } else {
    // Browser environment - use ClientLogger
    return import('./client.js').then(({ createClientLogger }) => 
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
    return import('./server.js').then(({ getServerLogger }) => 
      getServerLogger(config)
    )
  } else {
    // Browser environment
    return import('./client.js').then(({ getClientLogger }) => 
      getClientLogger(config)
    )
  }
}