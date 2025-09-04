import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  type ApiErrorResponse,
  type ApiSuccessResponse,
  ElevateApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  type ErrorCode,
  ErrorStatusCodes,
  ErrorSeverity,
  ErrorSeverityMap
} from '@elevate/types/errors.js'

// Sensitive data patterns for redaction
const SENSITIVE_PATTERNS = [
  // API Keys and tokens (enhanced patterns)
  /\b[Aa]pi[-_]?[Kk]ey\s*[:=]\s*['"`]?[^\s'"`]+['"`]?/gi,
  /\bsk[-_][a-zA-Z0-9]{20,}/gi,  // OpenAI-style API keys
  /\b[Aa]uthorization\s*:\s*[Bb]earer\s+[^\s]+/gi,
  /\b[Aa]ccess[-_]?[Tt]oken\s*[:=]\s*['"`]?[^\s'"`]+['"`]?/gi,
  /\b[Rr]efresh[-_]?[Tt]oken\s*[:=]\s*['"`]?[^\s'"`]+['"`]?/gi,
  /\b[Ss]ecret\s*[:=]\s*['"`]?[^\s'"`]+['"`]?/gi,
  /\b[Pp]assword\s*[:=]\s*['"`]?[^\s'"`]+['"`]?/gi,
  /\b[Cc]ookie\s*:\s*[^\r\n]+/gi,
  
  // JWT tokens (basic pattern)
  /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/gi,
  
  // Database connection strings
  /postgresql:\/\/[^\s]+/gi,
  /mysql:\/\/[^\s]+/gi,
  /mongodb:\/\/[^\s]+/gi,
  /redis:\/\/[^\s]+/gi,
  
  // File paths (Unix and Windows)
  /\/(?:Users|home|opt|var|etc|tmp|Applications)\/[^\s"'`<>|]+/gi,
  /[A-Z]:\\(?:Users|Program\s+Files|Windows|temp)[^\s"'`<>|]*/gi,
  
  // IP addresses (IPv4 and partial IPv6)
  /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
  /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g,
  
  // Email addresses (partial redaction)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  
  // Phone numbers (basic patterns)
  /\+?[1-9]\d{1,14}/g,
  
  // Credit card numbers (basic pattern)
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  
  // Common secret environment variable patterns (enhanced)
  /\b[A-Z_]*(?:SECRET|KEY|TOKEN|PASSWORD|AUTH|PRIVATE|CREDENTIAL)[A-Z_]*\s*[:=]\s*['"`]?[^\s'"`]+['"`]?/gi,
  
  // GitHub tokens, AWS keys, and other service tokens
  /\bgh[ps]_[A-Za-z0-9_]{36,}/gi,  // GitHub tokens
  /\bAKIA[0-9A-Z]{16}/gi,  // AWS Access Keys
  /\b[A-Za-z0-9/+=]{40}/g,  // AWS Secret Keys (basic pattern)
]

/**
 * Redacts sensitive information from text
 * @param text - The text to redact
 * @param preserveLength - Whether to preserve the length of redacted content
 * @returns Redacted text
 */
export function redactSensitiveData(
  text: string, 
  preserveLength: boolean = false
): string {
  if (!text || typeof text !== 'string') {
    return text
  }
  
  let redacted = text
  
  // Apply all sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      if (preserveLength) {
        return '*'.repeat(Math.min(match.length, 20))
      }
      return '[REDACTED]'
    })
  }
  
  return redacted
}

/**
 * Recursively redacts sensitive data from objects
 * @param obj - The object to redact
 * @param maxDepth - Maximum recursion depth
 * @returns Object with redacted sensitive data
 */
export function redactObjectSensitiveData(
  obj: any, 
  maxDepth: number = 5
): any {
  if (maxDepth <= 0) {
    return '[MAX_DEPTH_REACHED]'
  }
  
  if (obj === null || obj === undefined) {
    return obj
  }
  
  if (typeof obj === 'string') {
    return redactSensitiveData(obj)
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObjectSensitiveData(item, maxDepth - 1))
  }
  
  if (typeof obj === 'object') {
    const redacted: any = {}
    
    for (const [key, value] of Object.entries(obj)) {
      // Check if key suggests sensitive data
      const lowerKey = key.toLowerCase()
      const isSensitiveKey = [
        'password', 'secret', 'token', 'key', 'auth', 'authorization',
        'cookie', 'session', 'credential', 'private', 'confidential'
      ].some(sensitive => lowerKey.includes(sensitive))
      
      if (isSensitiveKey && typeof value === 'string') {
        redacted[key] = '[REDACTED]'
      } else {
        redacted[key] = redactObjectSensitiveData(value, maxDepth - 1)
      }
    }
    
    return redacted
  }
  
  return obj
}

/**
 * Safely prepares error data for logging (server-side only)
 * @param error - The error to prepare
 * @param includeStack - Whether to include stack trace (server-side only)
 * @returns Sanitized error data
 */
export function prepareErrorForLogging(
  error: Error, 
  includeStack: boolean = true
): Record<string, any> {
  const errorData: Record<string, any> = {
    name: error.name,
    message: redactSensitiveData(error.message),
  }
  
  // Only include stack trace in server-side logging, never in responses
  if (includeStack && error.stack) {
    errorData.stack = redactSensitiveData(error.stack)
  }
  
  if (error instanceof ElevateApiError) {
    errorData.code = error.code
    errorData.statusCode = error.statusCode
    errorData.severity = error.severity
    
    // Redact sensitive data from details
    if (error.details) {
      errorData.details = redactObjectSensitiveData(error.details)
    }
  }
  
  return errorData
}

// Generate a simple trace ID for error tracking
export function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Create standardized success response
export function createSuccessResponse<T>(
  data: T, 
  status: number = 200
): NextResponse {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data
  }
  return NextResponse.json(response, { status })
}

// Create standardized error response
export function createErrorResponse(
  error: unknown,
  fallbackStatus: number = 500,
  traceId?: string
): NextResponse {
  const finalTraceId = traceId || generateTraceId()

  // Handle our custom API errors
  if (error instanceof ElevateApiError) {
    // Sanitize error message before sending to client
    const sanitizedMessage = redactSensitiveData(error.message)
    
    const response: ApiErrorResponse = {
      success: false,
      error: sanitizedMessage,
      code: error.code,
      timestamp: new Date().toISOString(),
      traceId: finalTraceId,
      // SECURITY: Never include details in responses, even in development
      // Details may contain sensitive data and should only be server-side logged
    }
    
    // Log error for monitoring (server-side only)
    logError(error, finalTraceId)
    
    return NextResponse.json(response, { status: error.statusCode })
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    const validationError = new ValidationError(error, undefined, finalTraceId)
    return createErrorResponse(validationError, fallbackStatus, finalTraceId)
  }

  // Handle standard JavaScript errors
  if (error instanceof Error) {
    // Check for common error patterns to map to specific error types
    if (error.message === 'Unauthenticated' || error.message.includes('Unauthorized')) {
      const authError = new AuthenticationError(redactSensitiveData(error.message), finalTraceId)
      return createErrorResponse(authError, fallbackStatus, finalTraceId)
    }

    if (error.message.startsWith('Forbidden') || error.message.includes('Insufficient permissions')) {
      const authzError = new AuthorizationError(redactSensitiveData(error.message), finalTraceId)
      return createErrorResponse(authzError, fallbackStatus, finalTraceId)
    }

    // Generic error fallback - sanitize message and NEVER include stack traces
    const sanitizedMessage = redactSensitiveData(error.message)
    const response: ApiErrorResponse = {
      success: false,
      error: process.env.NODE_ENV === 'development' ? sanitizedMessage : 'An error occurred',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      traceId: finalTraceId,
      // SECURITY: Never include stack traces in JSON responses, even in development
      // Stack traces can contain sensitive file paths, variables, and other leaked data
    }

    logError(error, finalTraceId)
    return NextResponse.json(response, { status: fallbackStatus })
  }

  // Handle unknown errors
  const response: ApiErrorResponse = {
    success: false,
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR', 
    timestamp: new Date().toISOString(),
    traceId: finalTraceId
  }

  logError(new Error('Unknown error'), finalTraceId, { 
    originalError: redactObjectSensitiveData(error)
  })
  return NextResponse.json(response, { status: fallbackStatus })
}

// Quick error response helpers
export function unauthorized(message?: string, traceId?: string): NextResponse {
  const sanitizedMessage = message ? redactSensitiveData(message) : message
  return createErrorResponse(new AuthenticationError(sanitizedMessage, traceId))
}

export function forbidden(message?: string, traceId?: string): NextResponse {
  const sanitizedMessage = message ? redactSensitiveData(message) : message
  return createErrorResponse(new AuthorizationError(sanitizedMessage, traceId))
}

export function notFound(resource: string, id?: string, traceId?: string): NextResponse {
  // Sanitize resource and id to prevent path/sensitive data leaks
  const sanitizedResource = redactSensitiveData(resource)
  const sanitizedId = id ? redactSensitiveData(id) : id
  
  const error = new ElevateApiError(
    sanitizedId ? `${sanitizedResource} with id '${sanitizedId}' not found` : `${sanitizedResource} not found`,
    'NOT_FOUND',
    { resource: sanitizedResource, id: sanitizedId },
    traceId
  )
  return createErrorResponse(error)
}

export function badRequest(message: string, code?: ErrorCode, details?: unknown, traceId?: string): NextResponse {
  const sanitizedMessage = redactSensitiveData(message)
  const sanitizedDetails = details ? redactObjectSensitiveData(details) : details
  const error = new ElevateApiError(sanitizedMessage, code || 'INVALID_INPUT', sanitizedDetails, traceId)
  return createErrorResponse(error)
}

export function conflict(message: string, details?: unknown, traceId?: string): NextResponse {
  const sanitizedMessage = redactSensitiveData(message)
  const sanitizedDetails = details ? redactObjectSensitiveData(details) : details
  const error = new ElevateApiError(sanitizedMessage, 'RESOURCE_CONFLICT', sanitizedDetails, traceId)
  return createErrorResponse(error)
}

export function validationError(zodError: z.ZodError, customMessage?: string, traceId?: string): NextResponse {
  const sanitizedMessage = customMessage ? redactSensitiveData(customMessage) : customMessage
  const error = new ValidationError(zodError, sanitizedMessage, traceId)
  return createErrorResponse(error)
}

export function rateLimitExceeded(
  limit: number,
  windowMs: number,
  retryAfter?: number,
  traceId?: string
): NextResponse {
  const error = new ElevateApiError(
    `Rate limit exceeded. Maximum ${limit} requests per ${windowMs}ms window`,
    'RATE_LIMIT_EXCEEDED',
    { limit, windowMs, retryAfter },
    traceId
  )
  
  const response = createErrorResponse(error)
  
  // Add Retry-After header for rate limiting
  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString())
  }
  
  return response
}

// Re-export error classes for middleware and other consumers
export { ElevateApiError, ValidationError, AuthenticationError, AuthorizationError }

// Error logging function
export function logError(
  error: Error,
  traceId: string,
  context?: Record<string, unknown>
): void {
  const severity = error instanceof ElevateApiError 
    ? error.severity 
    : ErrorSeverity.HIGH

  // Use the new secure error preparation function
  const errorData = prepareErrorForLogging(error, true)
  
  const logData = {
    timestamp: new Date().toISOString(),
    traceId,
    error: errorData,
    context: context ? redactObjectSensitiveData(context) : undefined,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'
  }

  // In production, you would send this to your monitoring service
  // For now, we'll log to console with appropriate level
  // SECURITY: All logged data has been redacted of sensitive information
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      console.error('[CRITICAL ERROR]', JSON.stringify(logData, null, 2))
      break
    case ErrorSeverity.HIGH:
      console.error('[HIGH ERROR]', JSON.stringify(logData, null, 2))
      break
    case ErrorSeverity.MEDIUM:
      console.warn('[MEDIUM ERROR]', JSON.stringify(logData, null, 2))
      break
    case ErrorSeverity.LOW:
      console.log('[LOW ERROR]', JSON.stringify(logData, null, 2))
      break
    default:
      console.error('[ERROR]', JSON.stringify(logData, null, 2))
  }

  // TODO: Integrate with monitoring service (Sentry, LogRocket, etc.)
  // When integrating, ensure all data is redacted before sending:
  // if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  //   const sanitizedExtra = redactObjectSensitiveData({ traceId, context })
  //   Sentry.captureException(error, { extra: sanitizedExtra })
  // }
}

// Middleware for consistent error handling
export function withErrorHandling<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  context?: Record<string, unknown>
): T {
  return (async (...args: any[]) => {
    const traceId = generateTraceId()
    try {
      return await handler(...args)
    } catch (error) {
      // Sanitize context before logging
      const sanitizedContext = context ? redactObjectSensitiveData(context) : undefined
      
      logError(error instanceof Error ? error : new Error(String(error)), traceId, {
        handler: handler.name,
        ...sanitizedContext
      })
      return createErrorResponse(error, 500, traceId)
    }
  }) as T
}

// Validation helper for API requests
export function validateRequest<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  customMessage?: string,
  traceId?: string
): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error, customMessage, traceId)
    }
    throw error
  }
}

// Helper to check if error is a client error (4xx)
export function isClientError(error: unknown): boolean {
  if (error instanceof ElevateApiError) {
    return error.statusCode >= 400 && error.statusCode < 500
  }
  return false
}

// Helper to check if error is a server error (5xx)
export function isServerError(error: unknown): boolean {
  if (error instanceof ElevateApiError) {
    return error.statusCode >= 500
  }
  return true // Default to server error for unknown errors
}