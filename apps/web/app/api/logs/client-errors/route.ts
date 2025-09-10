import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { z } from 'zod'
import { ClientErrorReportSchema } from '@elevate/types'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { withRateLimit, publicApiRateLimiter } from '@elevate/security'

// Initialize logger (safe)
let logger: Awaited<ReturnType<typeof getSafeServerLogger>> | null = null
void (async () => {
  try {
    logger = await getSafeServerLogger('client-errors')
  } catch {
    console.warn('Failed to initialize client errors logger')
  }
})()

// Schema for client error reports (shared)
const ClientErrorSchema = ClientErrorReportSchema

export async function POST(request: NextRequest) {
  return withRateLimit(request, publicApiRateLimiter, async () => {
    try {
      // Basic rate limiting - only accept errors from same IP at most once per second
      const clientIP =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown'

      // Parse the request body
      const body = await request.json()
      const parsed = ClientErrorSchema.safeParse(body)

      if (!parsed.success) {
        return createErrorResponse(
          new Error('Invalid error report format'),
          400,
        )
      }

      const { level, message, error, context } = parsed.data

      // Extract useful context
      const logContext: {
        clientIP: string
        userAgent: string | null
        referer: string | null
        action: string
        component: string
        url?: string
        timestamp?: string
        sessionId?: string
        buildId?: string
        userId?: string
      } = {
        clientIP,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        action: 'client_error_report',
        component: 'client',
      }
      if (context?.url) logContext.url = context.url
      if (context?.timestamp) logContext.timestamp = context.timestamp
      if (context?.sessionId) logContext.sessionId = context.sessionId
      if (context?.buildId) logContext.buildId = context.buildId
      if (context?.userId) logContext.userId = context.userId

      // Log the client error
      if (logger) {
        const logFn =
          level === 'error'
            ? logger.error
            : level === 'warn'
            ? logger.warn
            : logger.info
        if (error) {
          const errorObj = new Error(error.message)
          if (error.name !== undefined) errorObj.name = error.name
          if (error.stack !== undefined) errorObj.stack = error.stack
          // Safe logger methods accept (msg, context) only
          logFn(`${message} :: ${errorObj.name}: ${errorObj.message}`)
          logFn('client-error-context', logContext)
        } else {
          logFn(message, logContext)
        }
      } else {
        // Fallback to console
        console.log(`[CLIENT-${level.toUpperCase()}]`, message, {
          error,
          context: logContext,
        })
      }

      return createSuccessResponse({ received: true })
    } catch (error) {
      // Log server error
      if (logger) {
        logger.error(
          'Failed to process client error report',
          error instanceof Error ? error : new Error(String(error)),
          {
            action: 'client_error_processing_failed',
            component: 'server',
          },
        )
      } else {
        console.error('Failed to process client error report:', error)
      }

      return createErrorResponse(
        new Error('Failed to process error report'),
        500,
      )
    }
  })
}

// Reject other methods
export async function GET() {
  return createErrorResponse(new Error('Method not allowed'), 405)
}
