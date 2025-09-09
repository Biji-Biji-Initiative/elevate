import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { z } from 'zod'
import { ClientErrorReportSchema } from '@elevate/types'
import { getSafeServerLogger } from '@elevate/logging/safe-server'

// Initialize logger
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
  try {
    // Basic rate limiting - only accept errors from same IP at most once per second
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    // Parse the request body
    const body = await request.json()
    const parsed = ClientErrorSchema.safeParse(body)

    if (!parsed.success) {
      return createErrorResponse(new Error('Invalid error report format'), 400)
    }

    const { level, message, error, context } = parsed.data

    // Extract useful context
    const logContext = {
      ...context,
      clientIP,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      action: 'client_error_report',
      component: 'client',
    }

    // Log the client error
    if (logger) {
      const log = (lvl: string, msg: string, err: Error | null, ctx: Record<string, unknown>) => {
        if (lvl === 'error') return logger!.error(msg, err || undefined, ctx)
        if (lvl === 'warn') return logger!.warn(msg, ctx)
        // map debug/info to info
        return logger!.info(msg, ctx)
      }
      if (error) {
        const errorObj = new Error(error.message)
        errorObj.name = error.name
        errorObj.stack = error.stack
        log(level, message, errorObj, logContext)
      } else {
        log(level, message, null, logContext)
      }
    } else {
      // Fallback to console
      console.log(`[CLIENT-${level.toUpperCase()}]`, message, { error, context: logContext })
    }

    return createSuccessResponse({ received: true })
  } catch (error) {
    // Log server error
    if (logger) {
      logger.error('Failed to process client error report', error as Error, {
        action: 'client_error_processing_failed',
        component: 'server',
      })
    } else {
      console.error('Failed to process client error report:', error)
    }

    return createErrorResponse(new Error('Failed to process error report'), 500)
  }
}

// Reject other methods
export async function GET() {
  return createErrorResponse(new Error('Method not allowed'), 405)
}
