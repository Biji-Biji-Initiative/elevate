import type { z } from 'zod'

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
  SELF_REFERRAL: 'SELF_REFERRAL',
  CIRCULAR_REFERRAL: 'CIRCULAR_REFERRAL',

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

  // Configuration
  INVALID_CONFIG: 'INVALID_CONFIG',

  // Test/Development
  TEST_ERROR: 'TEST_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  CUSTOM_ERROR: 'CUSTOM_ERROR',
} as const

export type ErrorCode = keyof typeof ErrorCodes

// Error severity levels for logging
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export type ErrorSeverityLevel =
  (typeof ErrorSeverity)[keyof typeof ErrorSeverity]

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
  SELF_REFERRAL: 400,
  CIRCULAR_REFERRAL: 400,

  FILE_TOO_LARGE: 413,
  INVALID_FILE_TYPE: 400,
  FILE_UPLOAD_FAILED: 500,

  RATE_LIMIT_EXCEEDED: 429,

  EXTERNAL_SERVICE_ERROR: 502,
  WEBHOOK_VALIDATION_FAILED: 400,

  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  DATABASE_ERROR: 500,

  INVALID_CONFIG: 500,

  TEST_ERROR: 500,
  CONNECTION_ERROR: 500,
  CUSTOM_ERROR: 500,
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
  SELF_REFERRAL: ErrorSeverity.MEDIUM,
  CIRCULAR_REFERRAL: ErrorSeverity.MEDIUM,

  FILE_TOO_LARGE: ErrorSeverity.LOW,
  INVALID_FILE_TYPE: ErrorSeverity.LOW,
  FILE_UPLOAD_FAILED: ErrorSeverity.HIGH,

  RATE_LIMIT_EXCEEDED: ErrorSeverity.MEDIUM,

  EXTERNAL_SERVICE_ERROR: ErrorSeverity.HIGH,
  WEBHOOK_VALIDATION_FAILED: ErrorSeverity.MEDIUM,

  INTERNAL_ERROR: ErrorSeverity.HIGH,
  SERVICE_UNAVAILABLE: ErrorSeverity.CRITICAL,
  DATABASE_ERROR: ErrorSeverity.CRITICAL,

  INVALID_CONFIG: ErrorSeverity.HIGH,

  TEST_ERROR: ErrorSeverity.LOW,
  CONNECTION_ERROR: ErrorSeverity.MEDIUM,
  CUSTOM_ERROR: ErrorSeverity.LOW,
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
    traceId?: string,
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
  constructor(zodError: z.ZodError, customMessage?: string, traceId?: string) {
    const message = customMessage || 'Validation failed'
    super(message, 'VALIDATION_ERROR', zodError.errors, traceId)
    this.name = 'ValidationError'
  }
}

// Authentication/Authorization errors
export class AuthenticationError extends ElevateApiError {
  constructor(message = 'Authentication required', traceId?: string) {
    super(message, 'UNAUTHORIZED', undefined, traceId)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends ElevateApiError {
  constructor(message = 'Insufficient permissions', traceId?: string) {
    super(message, 'FORBIDDEN', undefined, traceId)
    this.name = 'AuthorizationError'
  }
}

// Resource errors
export class NotFoundError extends ElevateApiError {
  constructor(resource: string, id?: string, traceId?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`
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
    traceId?: string,
  ) {
    super(
      `Rate limit exceeded. Maximum ${limit} requests per ${windowMs}ms window`,
      'RATE_LIMIT_EXCEEDED',
      { limit, windowMs, retryAfter },
      traceId,
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
    traceId?: string,
  ) {
    super(
      `${activityType} submission limit exceeded. Current: ${currentCount}, Maximum allowed: ${maxAllowed}`,
      'SUBMISSION_LIMIT_EXCEEDED',
      { activityType, currentCount, maxAllowed },
      traceId,
    )
    this.name = 'SubmissionLimitError'
  }
}

// Referral-specific errors
export class ReferralError extends ElevateApiError {
  constructor(
    code: 'SELF_REFERRAL' | 'CIRCULAR_REFERRAL',
    details?: unknown,
    traceId?: string,
  ) {
    const message =
      code === 'SELF_REFERRAL'
        ? 'Referrer and referee must be different users'
        : 'Circular referral detected within 30 days'
    super(message, code, details, traceId)
    this.name = 'ReferralError'
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
    traceId?: string,
  ) {
    super(
      `External service error: ${service} ${operation} failed`,
      'EXTERNAL_SERVICE_ERROR',
      { service, operation, originalError: originalError?.message },
      traceId,
    )
    this.name = 'ExternalServiceError'
  }
}

// Additional common error classes for consistency
export class ForbiddenError extends ElevateApiError {
  constructor(message = 'Forbidden', traceId?: string) {
    super(message, 'FORBIDDEN', undefined, traceId)
    this.name = 'ForbiddenError'
  }
}

// API-specific error class for HTTP client usage
export class APIError extends ElevateApiError {
  constructor(
    message: string,
    public status: number,
    public details?: unknown[],
  ) {
    // Map HTTP status codes to our error codes
    const codeMapping: Record<number, ErrorCode> = {
      400: 'INVALID_INPUT',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'RESOURCE_CONFLICT',
      413: 'FILE_TOO_LARGE',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_ERROR',
      502: 'EXTERNAL_SERVICE_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    }

    const code = codeMapping[status] || 'INTERNAL_ERROR'
    super(message, code, details)
    this.name = 'APIError'
    // Override with provided status using Object.defineProperty since statusCode is readonly
    Object.defineProperty(this, 'statusCode', {
      value: status,
      writable: false,
      enumerable: true,
      configurable: false,
    })
  }
}

// Error factory functions for consistency
export const createValidationError = (
  zodError: z.ZodError,
  customMessage?: string,
  traceId?: string,
): ValidationError => {
  return new ValidationError(zodError, customMessage, traceId)
}

export const createAuthenticationError = (
  message?: string,
  traceId?: string,
): AuthenticationError => {
  return new AuthenticationError(message, traceId)
}

export const createAuthorizationError = (
  message?: string,
  traceId?: string,
): AuthorizationError => {
  return new AuthorizationError(message, traceId)
}

export const createNotFoundError = (
  resource: string,
  id?: string,
  traceId?: string,
): NotFoundError => {
  return new NotFoundError(resource, id, traceId)
}

export const createConflictError = (
  message: string,
  details?: unknown,
  traceId?: string,
): ConflictError => {
  return new ConflictError(message, details, traceId)
}

export const createRateLimitError = (
  limit: number,
  windowMs: number,
  retryAfter?: number,
  traceId?: string,
): RateLimitError => {
  return new RateLimitError(limit, windowMs, retryAfter, traceId)
}

// Error serialization for API responses
export interface SerializableError {
  name: string
  message: string
  code?: ErrorCode
  statusCode?: number
  severity?: ErrorSeverityLevel
  timestamp: string
  traceId?: string
  details?: unknown
}

export const serializeError = (
  error: ElevateApiError,
  includeDetails = false,
): SerializableError => {
  const serialized: SerializableError = {
    name: error.name,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    severity: error.severity,
    timestamp: new Date().toISOString(),
    ...(error.traceId !== undefined ? { traceId: error.traceId } : {}),
  }

  if (includeDetails && error.details) {
    serialized.details = error.details
  }

  return serialized
}

// Type guards for error handling
export const isElevateApiError = (error: unknown): error is ElevateApiError => {
  return error instanceof ElevateApiError
}

export const isValidationError = (error: unknown): error is ValidationError => {
  return error instanceof ValidationError
}

export const isAuthenticationError = (
  error: unknown,
): error is AuthenticationError => {
  return error instanceof AuthenticationError
}

export const isAuthorizationError = (
  error: unknown,
): error is AuthorizationError => {
  return error instanceof AuthorizationError
}

export const isNotFoundError = (error: unknown): error is NotFoundError => {
  return error instanceof NotFoundError
}

export const isConflictError = (error: unknown): error is ConflictError => {
  return error instanceof ConflictError
}

export const isRateLimitError = (error: unknown): error is RateLimitError => {
  return error instanceof RateLimitError
}

// Discriminated union type for comprehensive error handling
export type AppError =
  | ElevateApiError
  | ValidationError
  | AuthenticationError
  | AuthorizationError
  | NotFoundError
  | ConflictError
  | RateLimitError
  | SubmissionLimitError
  | FileValidationError
  | ExternalServiceError
  | ForbiddenError
  | APIError

// Error code uniqueness validation (for testing)
export const validateErrorCodeUniqueness = (): boolean => {
  const codes = Object.values(ErrorCodes)
  const uniqueCodes = new Set(codes)
  return codes.length === uniqueCodes.size
}

// Default error message mappings
export const DefaultErrorMessages: Record<ErrorCode, string> = {
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access forbidden',
  TOKEN_EXPIRED: 'Authentication token has expired',
  INVALID_CREDENTIALS: 'Invalid credentials provided',

  VALIDATION_ERROR: 'Input validation failed',
  INVALID_INPUT: 'Invalid input provided',
  MISSING_REQUIRED_FIELD: 'Required field is missing',

  NOT_FOUND: 'Resource not found',
  ALREADY_EXISTS: 'Resource already exists',
  RESOURCE_CONFLICT: 'Resource conflict detected',

  SUBMISSION_LIMIT_EXCEEDED: 'Submission limit exceeded',
  INVALID_SUBMISSION_STATUS: 'Invalid submission status',
  POINT_ADJUSTMENT_OUT_OF_BOUNDS: 'Point adjustment out of allowed bounds',
  SELF_REFERRAL: 'Cannot refer yourself',
  CIRCULAR_REFERRAL: 'Circular referral detected',

  FILE_TOO_LARGE: 'File size exceeds maximum allowed',
  INVALID_FILE_TYPE: 'Invalid file type',
  FILE_UPLOAD_FAILED: 'File upload failed',

  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',

  EXTERNAL_SERVICE_ERROR: 'External service unavailable',
  WEBHOOK_VALIDATION_FAILED: 'Webhook validation failed',

  INTERNAL_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  DATABASE_ERROR: 'Database operation failed',

  INVALID_CONFIG: 'Invalid configuration',

  TEST_ERROR: 'Test error',
  CONNECTION_ERROR: 'Connection failed',
  CUSTOM_ERROR: 'Custom error',
}
