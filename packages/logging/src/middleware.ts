import { NextRequest, NextResponse } from 'next/server'
import type { ServerLogger } from './server.js'
import { createTimer, endTimer, extractRequestInfo } from './utils.js'
import type { LogContext, ApiLogData, DatabaseLogData, AuthLogData } from './types.js'

/**
 * Middleware for logging Next.js API requests
 */
export function withRequestLogging(logger: ServerLogger) {
  return function requestLoggingMiddleware<T extends any[]>(
    handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
  ) {
    return async function loggedHandler(request: NextRequest, ...args: T): Promise<NextResponse> {
      const timer = createTimer()
      const requestLogger = logger.forRequestWithHeaders(request)
      const requestInfo = extractRequestInfo(request)

      // Log request start
      requestLogger.info('Request started', {
        action: 'request_start',
        method: requestInfo.method,
        url: requestInfo.url,
        userAgent: requestInfo.userAgent,
        ip: requestInfo.ip,
      })

      try {
        const response = await handler(request, ...args)
        const timing = endTimer(timer)

        // Log successful request
        const apiData: ApiLogData = {
          method: requestInfo.method,
          url: requestInfo.url,
          statusCode: response.status,
          duration: timing.duration,
          ...(requestInfo.userAgent && { userAgent: requestInfo.userAgent }),
          ...(requestInfo.ip && { ip: requestInfo.ip })
        }
        requestLogger.api(apiData)

        return response
      } catch (error) {
        const timing = endTimer(timer)

        // Log failed request
        requestLogger.error('Request failed', error as Error, {
          action: 'request_failed',
          method: requestInfo.method,
          url: requestInfo.url,
          duration: timing.duration,
          userAgent: requestInfo.userAgent,
          ip: requestInfo.ip,
        })

        throw error
      }
    }
  }
}

/**
 * Higher-order function to add error logging to API handlers
 */
export function withErrorLogging(logger: ServerLogger, context?: LogContext) {
  return function errorLoggingWrapper<T extends any[]>(
    handler: (...args: T) => Promise<NextResponse>
  ) {
    return async function loggedHandler(...args: T): Promise<NextResponse> {
      try {
        return await handler(...args)
      } catch (error) {
        logger.error('API handler error', error as Error, {
          ...context,
          action: 'api_error',
        })
        throw error
      }
    }
  }
}

/**
 * Database operation logging wrapper
 */
export function withDatabaseLogging<T>(
  logger: ServerLogger,
  operation: string,
  table?: string
) {
  return async function databaseWrapper(
    dbOperation: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const timer = createTimer()

    try {
      const result = await dbOperation()
      const timing = endTimer(timer)

      const dbData: DatabaseLogData = {
        operation,
        duration: timing.duration!,
        ...(table && { table })
      }
      logger.database(dbData, context)

      return result
    } catch (error) {
      const timing = endTimer(timer)

      const dbErrorData: DatabaseLogData = {
        operation,
        duration: timing.duration!,
        error: error instanceof Error ? error.message : String(error),
        ...(table && { table })
      }
      logger.database(dbErrorData, context)

      throw error
    }
  }
}

/**
 * Authentication operation logging wrapper
 */
export function withAuthLogging(logger: ServerLogger) {
  return function authWrapper(
    action: 'login' | 'logout' | 'signup' | 'password_reset' | 'email_verify' | 'role_check' | 'permission_check',
    userId?: string,
    provider?: string
  ) {
    return async function loggedAuthOperation<T>(
      authOperation: () => Promise<T>,
      context?: LogContext
    ): Promise<T> {
      try {
        const result = await authOperation()

        const authData: AuthLogData = {
          action,
          success: true,
          ...(userId && { userId }),
          ...(provider && { provider })
        }
        logger.auth(authData, context)

        return result
      } catch (error) {
        const authErrorData: AuthLogData = {
          action,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          ...(userId && { userId }),
          ...(provider && { provider })
        }
        logger.auth(authErrorData, context)

        throw error
      }
    }
  }
}

/**
 * Webhook processing logging wrapper
 */
export function withWebhookLogging(
  logger: ServerLogger,
  provider: string,
  eventType: string
) {
  return async function webhookWrapper<T>(
    webhookHandler: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const timer = createTimer()

    try {
      const result = await webhookHandler()
      const timing = endTimer(timer)

      logger.webhook({
        provider,
        eventType,
        success: true,
        duration: timing.duration!,
      }, context)

      return result
    } catch (error) {
      const timing = endTimer(timer)

      logger.webhook({
        provider,
        eventType,
        success: false,
        duration: timing.duration!,
        error: error instanceof Error ? error.message : String(error),
      }, context)

      throw error
    }
  }
}

/**
 * Performance monitoring wrapper
 */
export function withPerformanceLogging(
  logger: ServerLogger,
  operation: string
) {
  return async function performanceWrapper<T>(
    handler: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const timer = createTimer()
    const startMemory = process.memoryUsage()

    try {
      const result = await handler()
      const timing = endTimer(timer)
      const endMemory = process.memoryUsage()

      logger.performance({
        operation,
        duration: timing.duration!,
        memory: {
          used: endMemory.heapUsed - startMemory.heapUsed,
          free: endMemory.heapTotal - endMemory.heapUsed,
          total: endMemory.heapTotal,
        },
      }, context)

      return result
    } catch (error) {
      const timing = endTimer(timer)

      logger.performance({
        operation,
        duration: timing.duration!,
      }, {
        ...context,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }
}