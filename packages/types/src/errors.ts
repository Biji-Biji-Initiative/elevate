import { z } from 'zod'

// Standard error response format
export interface ApiErrorResponse {
  success: false
  error: string
  code?: string
  details?: unknown
  timestamp?: string
  traceId?: string
}

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

// Error codes for consistent error handling
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  
  // Business Logic
  SUBMISSION_LIMIT_EXCEEDED: 'SUBMISSION_LIMIT_EXCEEDED',
  INVALID_SUBMISSION_STATUS: 'INVALID_SUBMISSION_STATUS',
  POINT_ADJUSTMENT_OUT_OF_BOUNDS: 'POINT_ADJUSTMENT_OUT_OF_BOUNDS',
  
  // Files
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // External Services
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  WEBHOOK_VALIDATION_FAILED: 'WEBHOOK_VALIDATION_FAILED',
  
  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const

export type ErrorCode = keyof typeof ErrorCodes

// Error severity levels for logging
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium', 
  HIGH: 'high',
  CRITICAL: 'critical'
} as const

export type ErrorSeverityLevel = (typeof ErrorSeverity)[keyof typeof ErrorSeverity]

// Standard HTTP status code mappings
export const ErrorStatusCodes: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TOKEN_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  
  VALIDATION_ERROR: 400,
  INVALID_INPUT: 400,
  MISSING_REQUIRED_FIELD: 400,
  
  NOT_FOUND: 404,
  ALREADY_EXISTS: 409,
  RESOURCE_CONFLICT: 409,
  
  SUBMISSION_LIMIT_EXCEEDED: 400,
  INVALID_SUBMISSION_STATUS: 400,
  POINT_ADJUSTMENT_OUT_OF_BOUNDS: 400,
  
  FILE_TOO_LARGE: 413,
  INVALID_FILE_TYPE: 400,
  FILE_UPLOAD_FAILED: 500,
  
  RATE_LIMIT_EXCEEDED: 429,
  
  EXTERNAL_SERVICE_ERROR: 502,
  WEBHOOK_VALIDATION_FAILED: 400,
  
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  DATABASE_ERROR: 500,
}

// Error severity mappings
export const ErrorSeverityMap: Record<ErrorCode, ErrorSeverityLevel> = {
  UNAUTHORIZED: ErrorSeverity.LOW,
  FORBIDDEN: ErrorSeverity.LOW,
  TOKEN_EXPIRED: ErrorSeverity.LOW,
  INVALID_CREDENTIALS: ErrorSeverity.LOW,
  
  VALIDATION_ERROR: ErrorSeverity.LOW,
  INVALID_INPUT: ErrorSeverity.LOW,
  MISSING_REQUIRED_FIELD: ErrorSeverity.LOW,
  
  NOT_FOUND: ErrorSeverity.LOW,
  ALREADY_EXISTS: ErrorSeverity.LOW,
  RESOURCE_CONFLICT: ErrorSeverity.MEDIUM,
  
  SUBMISSION_LIMIT_EXCEEDED: ErrorSeverity.MEDIUM,
  INVALID_SUBMISSION_STATUS: ErrorSeverity.LOW,
  POINT_ADJUSTMENT_OUT_OF_BOUNDS: ErrorSeverity.MEDIUM,
  
  FILE_TOO_LARGE: ErrorSeverity.LOW,
  INVALID_FILE_TYPE: ErrorSeverity.LOW,
  FILE_UPLOAD_FAILED: ErrorSeverity.HIGH,
  
  RATE_LIMIT_EXCEEDED: ErrorSeverity.MEDIUM,
  
  EXTERNAL_SERVICE_ERROR: ErrorSeverity.HIGH,
  WEBHOOK_VALIDATION_FAILED: ErrorSeverity.MEDIUM,
  
  INTERNAL_ERROR: ErrorSeverity.HIGH,
  SERVICE_UNAVAILABLE: ErrorSeverity.CRITICAL,
  DATABASE_ERROR: ErrorSeverity.CRITICAL,
}

// Custom error classes
export class ElevateApiError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly severity: ErrorSeverityLevel
  public readonly details?: unknown
  public readonly traceId?: string

  constructor(
    message: string,
    code: ErrorCode = 'INTERNAL_ERROR',
    details?: unknown,
    traceId?: string
  ) {
    super(message)
    this.name = 'ElevateApiError'
    this.code = code
    this.statusCode = ErrorStatusCodes[code]
    this.severity = ErrorSeverityMap[code]
    this.details = details
    if (traceId !== undefined) {
      this.traceId = traceId
    }
  }
}

// Validation error for Zod errors
export class ValidationError extends ElevateApiError {
  constructor(
    zodError: z.ZodError,
    customMessage?: string,
    traceId?: string
  ) {
    const message = customMessage || 'Validation failed'
    super(message, 'VALIDATION_ERROR', zodError.errors, traceId)
    this.name = 'ValidationError'
  }
}

// Authentication/Authorization errors
export class AuthenticationError extends ElevateApiError {
  constructor(message: string = 'Authentication required', traceId?: string) {
    super(message, 'UNAUTHORIZED', undefined, traceId)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends ElevateApiError {
  constructor(message: string = 'Insufficient permissions', traceId?: string) {
    super(message, 'FORBIDDEN', undefined, traceId)
    this.name = 'AuthorizationError'
  }
}

// Resource errors
export class NotFoundError extends ElevateApiError {
  constructor(resource: string, id?: string, traceId?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`
    super(message, 'NOT_FOUND', { resource, id }, traceId)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends ElevateApiError {
  constructor(message: string, details?: unknown, traceId?: string) {
    super(message, 'RESOURCE_CONFLICT', details, traceId)
    this.name = 'ConflictError'
  }
}

// Rate limiting
export class RateLimitError extends ElevateApiError {
  constructor(
    limit: number,
    windowMs: number,
    retryAfter?: number,
    traceId?: string
  ) {
    super(
      `Rate limit exceeded. Maximum ${limit} requests per ${windowMs}ms window`,
      'RATE_LIMIT_EXCEEDED',
      { limit, windowMs, retryAfter },
      traceId
    )
    this.name = 'RateLimitError'
  }
}

// Business logic errors
export class SubmissionLimitError extends ElevateApiError {
  constructor(
    activityType: string,
    currentCount: number,
    maxAllowed: number,
    traceId?: string
  ) {
    super(
      `${activityType} submission limit exceeded. Current: ${currentCount}, Maximum allowed: ${maxAllowed}`,
      'SUBMISSION_LIMIT_EXCEEDED',
      { activityType, currentCount, maxAllowed },
      traceId
    )
    this.name = 'SubmissionLimitError'
  }
}

// File handling errors
export class FileValidationError extends ElevateApiError {
  constructor(message: string, details?: unknown, traceId?: string) {
    super(message, 'INVALID_FILE_TYPE', details, traceId)
    this.name = 'FileValidationError'
  }
}

// External service errors  
export class ExternalServiceError extends ElevateApiError {
  constructor(
    service: string,
    operation: string,
    originalError?: Error,
    traceId?: string
  ) {
    super(
      `External service error: ${service} ${operation} failed`,
      'EXTERNAL_SERVICE_ERROR',
      { service, operation, originalError: originalError?.message },
      traceId
    )
    this.name = 'ExternalServiceError'
  }
}