import { NextRequest, NextResponse } from 'next/server'

import { generateRequestId, generateTraceId, extractRequestInfo } from './utils'

import type { LogContext } from './types'

// Extend NextRequest to include our log data
interface NextRequestWithLogData extends NextRequest {
  __logData?: LogContext
  __logEntry?: LogContext
}

/**
 * Next.js API route middleware for request logging and tracing
 */
export function withLogging<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const startTime = Date.now()
    const requestId = generateRequestId()
    const traceId = generateTraceId()
    
    // Extract request information
    const requestInfo = extractRequestInfo(request)
    
    // Create request context
    const context: LogContext = {
      requestId,
      traceId,
      ...requestInfo,
    }

    // Add headers for downstream services
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-request-id', requestId)
    requestHeaders.set('x-trace-id', traceId)

    // Create new request with headers
    const requestWithHeaders = new NextRequest(request.url, {
      method: request.method,
      headers: requestHeaders,
      body: request.body,
    })

    let response: NextResponse
    let statusCode = 200
    let error: Error | undefined

    try {
      // Call the original handler
      response = await handler(requestWithHeaders, ...args)
      statusCode = response.status
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err))
      statusCode = 500
      
      // Create error response
      response = NextResponse.json(
        {
          success: false,
          error: 'Internal Server Error',
          requestId,
        },
        { status: 500 }
      )
    }

    const duration = Date.now() - startTime

    // Add response headers for tracing
    response.headers.set('x-request-id', requestId)
    response.headers.set('x-trace-id', traceId)
    response.headers.set('x-response-time', `${duration}ms`)

    // Log the request (this would be picked up by the logger)
    const logData = {
      ...context,
      statusCode,
      duration,
      error: error ? error.message : undefined,
    }

    // Store in request for downstream logging
    ;(requestWithHeaders as NextRequestWithLogData).__logData = logData

    return response
  }
}

/**
 * Get log data from request (set by withLogging middleware)
 */
export function getRequestLogData(request: NextRequest): LogContext | undefined {
  return (request as NextRequestWithLogData).__logData
}

/**
 * Enhanced logging wrapper with automatic error handling
 */
export function withApiLogging<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse> | NextResponse,
  options: {
    operation?: string
    timeout?: number
    skipLogging?: boolean
  } = {}
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const startTime = Date.now()
    const requestId = generateRequestId()
    const traceId = generateTraceId()
    
    const requestInfo = extractRequestInfo(request)
    const operation = options.operation || `${request.method} ${requestInfo.url}`
    
    const context: LogContext = {
      requestId,
      traceId,
      operation,
      ...requestInfo,
    }

    let response: NextResponse
    let statusCode = 200
    let error: Error | undefined

    try {
      // Set timeout if specified
      let handlerPromise = handler(request, ...args)
      
      if (options.timeout) {
        const timeoutPromise = new Promise<NextResponse>((_, reject) => {
          setTimeout(() => reject(new Error(`Request timeout after ${options.timeout}ms`)), options.timeout)
        })
        
        handlerPromise = Promise.race([handlerPromise, timeoutPromise])
      }

      response = await handlerPromise
      statusCode = response.status
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err))
      statusCode = error.message.includes('timeout') ? 408 : 500
      
      response = NextResponse.json(
        {
          success: false,
          error: statusCode === 408 ? 'Request Timeout' : 'Internal Server Error',
          requestId,
        },
        { status: statusCode }
      )
    }

    const duration = Date.now() - startTime

    // Add tracing headers
    response.headers.set('x-request-id', requestId)
    response.headers.set('x-trace-id', traceId)
    response.headers.set('x-response-time', `${duration}ms`)

    // Log the request (using the logger would happen here)
    if (!options.skipLogging) {
      const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
      
      // This would be logged by the actual logger implementation
      const logEntry = {
        level: logLevel,
        message: `API ${operation} ${statusCode} ${duration}ms`,
        context: {
          ...context,
          statusCode,
          duration,
          error: error ? error.message : undefined,
        },
        timestamp: new Date().toISOString(),
      }

      // Store for downstream access
      ;(request as NextRequestWithLogData).__logEntry = logEntry
    }

    return response
  }
}

/**
 * Database operation logging middleware
 */
export function withDatabaseLogging<T extends unknown[], R>(
  operation: string,
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now()
    const requestId = generateRequestId()
    
    try {
      const result = await fn(...args)
      const duration = Date.now() - startTime
      
      // Log successful database operation
      const logEntry = {
        level: 'info',
        message: `Database ${operation} completed (${duration}ms)`,
        context: {
          requestId,
          operation,
          duration,
          table: operation.includes(' ') ? operation.split(' ')[1] : undefined,
        },
        timestamp: new Date().toISOString(),
      }

      console.log('DB_LOG:', JSON.stringify(logEntry))
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      const err = error instanceof Error ? error : new Error(String(error))
      
      // Log failed database operation
      const logEntry = {
        level: 'error',
        message: `Database ${operation} failed: ${err.message}`,
        context: {
          requestId,
          operation,
          duration,
          error: err.message,
          stack: err.stack,
        },
        timestamp: new Date().toISOString(),
      }

      console.error('DB_ERROR:', JSON.stringify(logEntry))
      
      throw error
    }
  }
}
