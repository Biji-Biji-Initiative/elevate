import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, createErrorResponse } from '@elevate/http'
import { z } from 'zod'
import { ClientErrorReportSchema } from '@elevate/types'

// Initialize logger
type ServerLogger = import('@elevate/logging/server').ServerLogger
let logger: ServerLogger | null = null
const initializeLogger = async () => {
  try {
    const { getServerLogger } = await import('@elevate/logging/server')
    logger = getServerLogger({ name: 'client-errors' })
  } catch (error) {
    console.warn('Failed to initialize client errors logger')
  }
}

initializeLogger()

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
      if (error) {
        const errorObj = new Error(error.message)
        errorObj.name = error.name
        errorObj.stack = error.stack
        
        logger[level](message, errorObj, logContext)
      } else {
        logger[level](message, logContext)
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
