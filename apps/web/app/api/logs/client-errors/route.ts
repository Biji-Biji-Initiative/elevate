import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Initialize logger
let logger: any = null
const initializeLogger = async () => {
  try {
    const { getServerLogger } = await import('@elevate/logging/server')
    logger = getServerLogger({ name: 'client-errors' })
  } catch (error) {
    console.warn('Failed to initialize client errors logger')
  }
}

initializeLogger()

// Schema for client error reports
const ClientErrorSchema = z.object({
  level: z.enum(['error', 'warn', 'info']),
  message: z.string(),
  error: z.object({
    name: z.string(),
    message: z.string(),
    stack: z.string().optional(),
  }).optional(),
  context: z.object({
    url: z.string().optional(),
    userId: z.string().optional(),
    userAgent: z.string().optional(),
    timestamp: z.string().optional(),
    component: z.string().optional(),
    action: z.string().optional(),
    sessionId: z.string().optional(),
    buildId: z.string().optional()
  }).optional(),
})

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
      return NextResponse.json(
        { success: false, error: 'Invalid error report format' },
        { status: 400 }
      )
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

    return NextResponse.json({ success: true })
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

    return NextResponse.json(
      { success: false, error: 'Failed to process error report' },
      { status: 500 }
    )
  }
}

// Reject other methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}