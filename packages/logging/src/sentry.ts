import * as Sentry from '@sentry/node'
import type { LogContext, ErrorInfo } from './types.js'

/**
 * Sentry integration for server-side logging
 */
export class SentryIntegration {
  private static instance: SentryIntegration | undefined

  static getInstance(): SentryIntegration {
    if (!SentryIntegration.instance) {
      SentryIntegration.instance = new SentryIntegration()
    }
    return SentryIntegration.instance
  }

  /**
   * Initialize Sentry if DSN is available
   */
  static init(
    options: {
      dsn?: string
      environment?: string
      release?: string
      sampleRate?: number
    } = {},
  ) {
    if (!options.dsn) {
      return false
    }

    try {
      const initOptions: Sentry.NodeOptions = {
        dsn: options.dsn,
        environment:
          options.environment || process.env.NODE_ENV || 'development',
        tracesSampleRate: options.sampleRate || 0.1,
        integrations: [
          // Disabled integrations due to API changes in Sentry v10
        ],
        ...(options.release && { release: options.release }),
      }
      Sentry.init(initOptions)
      return true
    } catch (error) {
      console.error('Failed to initialize Sentry:', error)
      return false
    }
  }

  /**
   * Check if Sentry is available
   */
  isEnabled(): boolean {
    try {
      // Simplified check for Sentry availability
      return typeof Sentry.init === 'function'
    } catch {
      return false
    }
  }

  /**
   * Capture an exception with context
   */
  captureException(error: unknown, context?: LogContext): string | undefined {
    if (!this.isEnabled()) return undefined

    return Sentry.withScope((scope) => {
      if (context) {
        // Set user context
        if (context.userId) {
          scope.setUser({ id: context.userId })
        }

        // Set tags
        Object.entries(context).forEach(([key, value]) => {
          if (typeof value === 'string' || typeof value === 'number') {
            scope.setTag(key, value)
          }
        })

        // Set extra context
        scope.setContext('log_context', context)
      }

      return Sentry.captureException(error)
    })
  }

  /**
   * Capture a message with context
   */
  captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: LogContext,
  ): string | undefined {
    if (!this.isEnabled()) return undefined

    return Sentry.withScope((scope) => {
      if (context) {
        // Set user context
        if (context.userId) {
          scope.setUser({ id: context.userId })
        }

        // Set tags
        Object.entries(context).forEach(([key, value]) => {
          if (typeof value === 'string' || typeof value === 'number') {
            scope.setTag(key, value)
          }
        })

        // Set extra context
        scope.setContext('log_context', context)
      }

      scope.setLevel(level)
      return Sentry.captureMessage(message)
    })
  }

  /**
   * Add breadcrumb for tracing
   */
  addBreadcrumb(
    message: string,
    category: string,
    level: Sentry.SeverityLevel = 'info',
    data?: Record<string, any>,
  ): void {
    if (!this.isEnabled()) return

    const breadcrumb: Sentry.Breadcrumb = {
      message,
      category,
      level,
      timestamp: Date.now() / 1000,
      ...(data && { data }),
    }
    Sentry.addBreadcrumb(breadcrumb)
  }

  /**
   * Start a transaction for performance monitoring
   */
  startTransaction(
    _name: string,
    _op: string,
    _context?: LogContext,
  ): undefined {
    if (!this.isEnabled()) return undefined

    // Disabled due to API changes in Sentry v10
    return undefined
  }

  /**
   * Set user context
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.isEnabled()) return

    Sentry.setUser(user)
  }

  /**
   * Set custom tag
   */
  setTag(key: string, value: string | number): void {
    if (!this.isEnabled()) return

    Sentry.setTag(key, value)
  }

  /**
   * Set custom context
   */
  setContext(key: string, context: Record<string, any>): void {
    if (!this.isEnabled()) return

    Sentry.setContext(key, context)
  }

  /**
   * Flush pending events
   */
  async flush(timeout = 2000): Promise<boolean> {
    if (!this.isEnabled()) return true

    return Sentry.flush(timeout)
  }

  /**
   * Close Sentry client
   */
  async close(timeout = 2000): Promise<boolean> {
    if (!this.isEnabled()) return true

    return Sentry.close(timeout)
  }
}

// Export singleton instance
export const sentry = SentryIntegration.getInstance()

// Export convenience functions
export const initSentry = SentryIntegration.init
export const captureException = (error: unknown, context?: LogContext) =>
  sentry.captureException(error, context)
export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: LogContext,
) => sentry.captureMessage(message, level, context)
export const addBreadcrumb = (
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, any>,
) => sentry.addBreadcrumb(message, category, level, data)
export const startTransaction = (
  name: string,
  op: string,
  context?: LogContext,
) => sentry.startTransaction(name, op, context)
export const setSentryUser = (user: {
  id: string
  email?: string
  username?: string
}) => sentry.setUser(user)
export const setSentryTag = (key: string, value: string | number) =>
  sentry.setTag(key, value)
export const setSentryContext = (key: string, context: Record<string, any>) =>
  sentry.setContext(key, context)
