import { Logger } from './logger.js'
import type { LoggerConfig, LogContext, LogMethodWithError } from './types.js'
import {
  generateRequestId,
  generateTraceId,
  extractRequestInfo,
  getMemoryUsage,
  getCpuUsage,
} from './utils.js'
import { sentry, SentryIntegration, captureException, addBreadcrumb } from './sentry.js'

/**
 * Server-side logger with enhanced features for Node.js environments
 */
export class ServerLogger extends Logger {
  constructor(config?: Partial<LoggerConfig>, baseContext?: LogContext) {
    super(config, baseContext)
    
    // Initialize Sentry if configured
    this.initializeSentry()
  }

  /**
   * Initialize Sentry integration
   */
  private initializeSentry(): void {
    const sentryDsn = process.env.SENTRY_DSN
    if (sentryDsn && !sentry.isEnabled()) {
      const sentryOptions = {
        dsn: sentryDsn,
        environment: process.env.NODE_ENV || 'development',
        sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        ...(process.env.VERCEL_GIT_COMMIT_SHA && { release: process.env.VERCEL_GIT_COMMIT_SHA })
      }
      const initialized = SentryIntegration.init(sentryOptions)
      
      if (initialized) {
        this.debug('Sentry integration initialized', { sentryEnabled: true })
      }
    }
  }

  /**
   * Override error logging to include Sentry
   */
  error: LogMethodWithError = (msg, error?, context?) => {
    // Call parent implementation
    const parentError = Logger.prototype.error
    parentError.call(this, msg, error, context)
    
    // Send to Sentry if available
    if (error && sentry.isEnabled()) {
      captureException(error, context)
      addBreadcrumb(msg, 'error', 'error', context)
    }
  }

  /**
   * Override fatal logging to include Sentry
   */
  fatal: LogMethodWithError = (msg, error?, context?) => {
    // Call parent implementation
    const parentFatal = Logger.prototype.fatal
    parentFatal.call(this, msg, error, context)
    
    // Send to Sentry if available
    if (error && sentry.isEnabled()) {
      captureException(error, context)
      addBreadcrumb(msg, 'error', 'fatal', context)
    }
  }

  /**
   * Create a request-scoped logger with automatic trace and request ID generation
   */
  forRequestWithHeaders(request: Request): Logger {
    const requestId = generateRequestId()
    const traceId = generateTraceId()
    const requestInfo = extractRequestInfo(request)

    return this.child({
      requestId,
      traceId,
      ...requestInfo,
    })
  }

  /**
   * Log system performance metrics
   */
  systemHealth(context?: LogContext): void {
    const memory = getMemoryUsage()
    const cpu = getCpuUsage()
    const uptime = process.uptime()

    this.performance(
      {
        operation: 'system_health',
        duration: uptime * 1000, // Convert to ms for consistency
        memory: {
          used: memory.used,
          free: memory.free,
          total: memory.total,
        },
        cpu: {
          user: cpu.user,
          system: cpu.system,
        },
        custom: {
          rss: memory.rss,
          external: memory.external,
          uptime,
        },
      },
      context
    )
  }

  /**
   * Log process exit or shutdown
   */
  processExit(code: number, reason?: string, context?: LogContext): void {
    this.info(
      `Process exiting with code ${code}${reason ? `: ${reason}` : ''}`,
      {
        ...context,
        exitCode: code,
        reason,
      }
    )
  }

  /**
   * Log uncaught exceptions
   */
  uncaughtException(error: Error, context?: LogContext): void {
    this.fatal('Uncaught exception', error, {
      ...context,
      action: 'uncaught_exception',
    })
  }

  /**
   * Log unhandled promise rejections
   */
  unhandledRejection(reason: unknown, promise: Promise<unknown>, context?: LogContext): void {
    this.fatal('Unhandled promise rejection', reason instanceof Error ? reason : new Error(String(reason)), {
      ...context,
      action: 'unhandled_rejection',
      promise: promise.toString(),
    })
  }
}

// Default server logger instance
let defaultLogger: ServerLogger | undefined

/**
 * Get the default server logger instance
 */
export function getServerLogger(config?: Partial<LoggerConfig>): ServerLogger {
  if (!defaultLogger || config) {
    defaultLogger = new ServerLogger(config)
  }
  return defaultLogger
}

/**
 * Create a new server logger instance
 */
export function createServerLogger(config?: Partial<LoggerConfig>, context?: LogContext): ServerLogger {
  return new ServerLogger(config, context)
}

// Re-export for convenience
export { Logger } from './logger.js'
export type * from './types.js'