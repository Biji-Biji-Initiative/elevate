import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import {
  ElevateApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  SubmissionLimitError,
  FileValidationError,
  ExternalServiceError,
  ForbiddenError,
  APIError,
  ErrorCodes,
  ErrorStatusCodes,
  ErrorSeverity,
  ErrorSeverityMap,
  createValidationError,
  createAuthenticationError,
  createAuthorizationError,
  createNotFoundError,
  createConflictError,
  createRateLimitError,
  serializeError,
  isElevateApiError,
  isValidationError,
  isAuthenticationError,
  isAuthorizationError,
  isNotFoundError,
  isConflictError,
  isRateLimitError,
  validateErrorCodeUniqueness,
  DefaultErrorMessages,
  type AppError,
  type ErrorCode,
  type ErrorSeverityLevel
} from '@elevate/types/errors'

describe('Error System', () => {
  describe('ElevateApiError base class', () => {
    it('should create error with all properties', () => {
      const error = new ElevateApiError(
        'Test error message',
        'VALIDATION_ERROR',
        { test: 'details' },
        'trace_123'
      )
      
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('ElevateApiError')
      expect(error.message).toBe('Test error message')
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.statusCode).toBe(400)
      expect(error.severity).toBe('low')
      expect(error.details).toEqual({ test: 'details' })
      expect(error.traceId).toBe('trace_123')
    })

    it('should use defaults when optional parameters are omitted', () => {
      const error = new ElevateApiError('Test message')
      
      expect(error.code).toBe('INTERNAL_ERROR')
      expect(error.statusCode).toBe(500)
      expect(error.severity).toBe('high')
      expect(error.details).toBeUndefined()
      expect(error.traceId).toBeUndefined()
    })
  })

  describe('ValidationError', () => {
    it('should create ValidationError from ZodError', () => {
      const schema = z.object({ name: z.string().min(1) })
      const zodError = schema.safeParse({ name: '' }).error!
      
      const error = new ValidationError(zodError)
      
      expect(error).toBeInstanceOf(ElevateApiError)
      expect(error.name).toBe('ValidationError')
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.statusCode).toBe(400)
      expect(error.details).toBeDefined()
    })

    it('should accept custom message', () => {
      const schema = z.object({ name: z.string() })
      const zodError = schema.safeParse({ name: 123 }).error!
      
      const error = new ValidationError(zodError, 'Custom validation message')
      
      expect(error.message).toBe('Custom validation message')
    })
  })

  describe('AuthenticationError', () => {
    it('should create AuthenticationError with default message', () => {
      const error = new AuthenticationError()
      
      expect(error).toBeInstanceOf(ElevateApiError)
      expect(error.name).toBe('AuthenticationError')
      expect(error.code).toBe('UNAUTHORIZED')
      expect(error.statusCode).toBe(401)
      expect(error.message).toBe('Authentication required')
    })

    it('should accept custom message', () => {
      const error = new AuthenticationError('Token expired')
      
      expect(error.message).toBe('Token expired')
    })
  })

  describe('AuthorizationError', () => {
    it('should create AuthorizationError with default message', () => {
      const error = new AuthorizationError()
      
      expect(error).toBeInstanceOf(ElevateApiError)
      expect(error.name).toBe('AuthorizationError')
      expect(error.code).toBe('FORBIDDEN')
      expect(error.statusCode).toBe(403)
      expect(error.message).toBe('Insufficient permissions')
    })
  })

  describe('NotFoundError', () => {
    it('should create NotFoundError with resource only', () => {
      const error = new NotFoundError('User')
      
      expect(error).toBeInstanceOf(ElevateApiError)
      expect(error.name).toBe('NotFoundError')
      expect(error.code).toBe('NOT_FOUND')
      expect(error.statusCode).toBe(404)
      expect(error.message).toBe('User not found')
      expect(error.details).toEqual({ resource: 'User', id: undefined })
    })

    it('should create NotFoundError with resource and ID', () => {
      const error = new NotFoundError('User', '123')
      
      expect(error.message).toBe('User with id \'123\' not found')
      expect(error.details).toEqual({ resource: 'User', id: '123' })
    })
  })

  describe('ConflictError', () => {
    it('should create ConflictError', () => {
      const error = new ConflictError('Resource already exists', { existingId: '123' })
      
      expect(error).toBeInstanceOf(ElevateApiError)
      expect(error.name).toBe('ConflictError')
      expect(error.code).toBe('RESOURCE_CONFLICT')
      expect(error.statusCode).toBe(409)
      expect(error.message).toBe('Resource already exists')
      expect(error.details).toEqual({ existingId: '123' })
    })
  })

  describe('RateLimitError', () => {
    it('should create RateLimitError with all parameters', () => {
      const error = new RateLimitError(100, 60000, 30)
      
      expect(error).toBeInstanceOf(ElevateApiError)
      expect(error.name).toBe('RateLimitError')
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(error.statusCode).toBe(429)
      expect(error.message).toBe('Rate limit exceeded. Maximum 100 requests per 60000ms window')
      expect(error.details).toEqual({ limit: 100, windowMs: 60000, retryAfter: 30 })
    })
  })

  describe('SubmissionLimitError', () => {
    it('should create SubmissionLimitError', () => {
      const error = new SubmissionLimitError('AMPLIFY', 3, 2)
      
      expect(error).toBeInstanceOf(ElevateApiError)
      expect(error.name).toBe('SubmissionLimitError')
      expect(error.code).toBe('SUBMISSION_LIMIT_EXCEEDED')
      expect(error.message).toBe('AMPLIFY submission limit exceeded. Current: 3, Maximum allowed: 2')
      expect(error.details).toEqual({ 
        activityType: 'AMPLIFY', 
        currentCount: 3, 
        maxAllowed: 2 
      })
    })
  })

  describe('FileValidationError', () => {
    it('should create FileValidationError', () => {
      const error = new FileValidationError('Invalid file type', { type: 'text/plain' })
      
      expect(error).toBeInstanceOf(ElevateApiError)
      expect(error.name).toBe('FileValidationError')
      expect(error.code).toBe('INVALID_FILE_TYPE')
      expect(error.message).toBe('Invalid file type')
      expect(error.details).toEqual({ type: 'text/plain' })
    })
  })

  describe('ExternalServiceError', () => {
    it('should create ExternalServiceError', () => {
      const originalError = new Error('Network timeout')
      const error = new ExternalServiceError('Kajabi', 'webhook', originalError)
      
      expect(error).toBeInstanceOf(ElevateApiError)
      expect(error.name).toBe('ExternalServiceError')
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR')
      expect(error.message).toBe('External service error: Kajabi webhook failed')
      expect(error.details).toEqual({ 
        service: 'Kajabi', 
        operation: 'webhook', 
        originalError: 'Network timeout' 
      })
    })
  })

  describe('ForbiddenError', () => {
    it('should create ForbiddenError with default message', () => {
      const error = new ForbiddenError()
      
      expect(error).toBeInstanceOf(ElevateApiError)
      expect(error.name).toBe('ForbiddenError')
      expect(error.code).toBe('FORBIDDEN')
      expect(error.message).toBe('Forbidden')
    })
  })

  describe('APIError', () => {
    it('should create APIError and map status to error code', () => {
      const error = new APIError('Bad request', 400, ['detail1', 'detail2'])
      
      expect(error).toBeInstanceOf(ElevateApiError)
      expect(error.name).toBe('APIError')
      expect(error.code).toBe('INVALID_INPUT')
      expect(error.statusCode).toBe(400)
      expect(error.status).toBe(400) // Additional property
      expect(error.details).toEqual(['detail1', 'detail2'])
    })

    it('should map various HTTP status codes correctly', () => {
      const testCases = [
        { status: 400, expectedCode: 'INVALID_INPUT' },
        { status: 401, expectedCode: 'UNAUTHORIZED' },
        { status: 403, expectedCode: 'FORBIDDEN' },
        { status: 404, expectedCode: 'NOT_FOUND' },
        { status: 409, expectedCode: 'RESOURCE_CONFLICT' },
        { status: 413, expectedCode: 'FILE_TOO_LARGE' },
        { status: 429, expectedCode: 'RATE_LIMIT_EXCEEDED' },
        { status: 500, expectedCode: 'INTERNAL_ERROR' },
        { status: 502, expectedCode: 'EXTERNAL_SERVICE_ERROR' },
        { status: 503, expectedCode: 'SERVICE_UNAVAILABLE' },
        { status: 999, expectedCode: 'INTERNAL_ERROR' } // Unknown status
      ]

      testCases.forEach(({ status, expectedCode }) => {
        const error = new APIError('Test message', status)
        expect(error.code).toBe(expectedCode)
      })
    })
  })

  describe('Error Factory Functions', () => {
    it('should create ValidationError with factory', () => {
      const schema = z.string()
      const zodError = schema.safeParse(123).error!
      
      const error = createValidationError(zodError, 'Custom message', 'trace_123')
      
      expect(error).toBeInstanceOf(ValidationError)
      expect(error.message).toBe('Custom message')
      expect(error.traceId).toBe('trace_123')
    })

    it('should create AuthenticationError with factory', () => {
      const error = createAuthenticationError('Token invalid', 'trace_456')
      
      expect(error).toBeInstanceOf(AuthenticationError)
      expect(error.message).toBe('Token invalid')
      expect(error.traceId).toBe('trace_456')
    })

    it('should create AuthorizationError with factory', () => {
      const error = createAuthorizationError('Access denied', 'trace_789')
      
      expect(error).toBeInstanceOf(AuthorizationError)
      expect(error.message).toBe('Access denied')
      expect(error.traceId).toBe('trace_789')
    })

    it('should create NotFoundError with factory', () => {
      const error = createNotFoundError('Post', '123', 'trace_abc')
      
      expect(error).toBeInstanceOf(NotFoundError)
      expect(error.message).toBe('Post with id \'123\' not found')
      expect(error.traceId).toBe('trace_abc')
    })

    it('should create ConflictError with factory', () => {
      const error = createConflictError('Duplicate entry', { field: 'email' }, 'trace_def')
      
      expect(error).toBeInstanceOf(ConflictError)
      expect(error.message).toBe('Duplicate entry')
      expect(error.details).toEqual({ field: 'email' })
      expect(error.traceId).toBe('trace_def')
    })

    it('should create RateLimitError with factory', () => {
      const error = createRateLimitError(10, 1000, 5, 'trace_ghi')
      
      expect(error).toBeInstanceOf(RateLimitError)
      expect(error.traceId).toBe('trace_ghi')
    })
  })

  describe('Error Serialization', () => {
    it('should serialize error without details', () => {
      const error = new ElevateApiError(
        'Test error',
        'VALIDATION_ERROR',
        { sensitive: 'data' },
        'trace_123'
      )
      
      const serialized = serializeError(error, false)
      
      expect(serialized).toEqual({
        name: 'ElevateApiError',
        message: 'Test error',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        severity: 'low',
        timestamp: expect.any(String),
        traceId: 'trace_123'
      })
      expect(serialized.details).toBeUndefined()
    })

    it('should serialize error with details when requested', () => {
      const error = new ElevateApiError(
        'Test error',
        'VALIDATION_ERROR',
        { test: 'data' },
        'trace_123'
      )
      
      const serialized = serializeError(error, true)
      
      expect(serialized.details).toEqual({ test: 'data' })
    })

    it('should handle error without details', () => {
      const error = new ElevateApiError('Test error')
      
      const serialized = serializeError(error, true)
      
      expect(serialized.details).toBeUndefined()
    })
  })

  describe('Type Guards', () => {
    const elevateError = new ElevateApiError('test')
    const validationError = new ValidationError(z.string().safeParse(123).error!)
    const authError = new AuthenticationError()
    const authzError = new AuthorizationError()
    const notFoundError = new NotFoundError('User')
    const conflictError = new ConflictError('Conflict')
    const rateLimitError = new RateLimitError(10, 1000)
    const regularError = new Error('regular')

    it('should identify ElevateApiError', () => {
      expect(isElevateApiError(elevateError)).toBe(true)
      expect(isElevateApiError(validationError)).toBe(true) // ValidationError extends ElevateApiError
      expect(isElevateApiError(regularError)).toBe(false)
    })

    it('should identify ValidationError', () => {
      expect(isValidationError(validationError)).toBe(true)
      expect(isValidationError(authError)).toBe(false)
      expect(isValidationError(regularError)).toBe(false)
    })

    it('should identify AuthenticationError', () => {
      expect(isAuthenticationError(authError)).toBe(true)
      expect(isAuthenticationError(authzError)).toBe(false)
      expect(isAuthenticationError(regularError)).toBe(false)
    })

    it('should identify AuthorizationError', () => {
      expect(isAuthorizationError(authzError)).toBe(true)
      expect(isAuthorizationError(authError)).toBe(false)
      expect(isAuthorizationError(regularError)).toBe(false)
    })

    it('should identify NotFoundError', () => {
      expect(isNotFoundError(notFoundError)).toBe(true)
      expect(isNotFoundError(conflictError)).toBe(false)
      expect(isNotFoundError(regularError)).toBe(false)
    })

    it('should identify ConflictError', () => {
      expect(isConflictError(conflictError)).toBe(true)
      expect(isConflictError(notFoundError)).toBe(false)
      expect(isConflictError(regularError)).toBe(false)
    })

    it('should identify RateLimitError', () => {
      expect(isRateLimitError(rateLimitError)).toBe(true)
      expect(isRateLimitError(conflictError)).toBe(false)
      expect(isRateLimitError(regularError)).toBe(false)
    })
  })

  describe('Error Code Validation', () => {
    it('should validate error codes are unique', () => {
      expect(validateErrorCodeUniqueness()).toBe(true)
    })

    it('should have consistent error codes and status mappings', () => {
      const allCodes = Object.values(ErrorCodes)
      
      // Every error code should have a status mapping
      allCodes.forEach(code => {
        expect(ErrorStatusCodes[code]).toBeDefined()
        expect(typeof ErrorStatusCodes[code]).toBe('number')
        expect(ErrorStatusCodes[code]).toBeGreaterThanOrEqual(400)
        expect(ErrorStatusCodes[code]).toBeLessThanOrEqual(599)
      })
    })

    it('should have consistent error codes and severity mappings', () => {
      const allCodes = Object.values(ErrorCodes)
      
      // Every error code should have a severity mapping
      allCodes.forEach(code => {
        expect(ErrorSeverityMap[code]).toBeDefined()
        expect(Object.values(ErrorSeverity)).toContain(ErrorSeverityMap[code])
      })
    })

    it('should have default messages for all error codes', () => {
      const allCodes = Object.values(ErrorCodes)
      
      // Every error code should have a default message
      allCodes.forEach(code => {
        expect(DefaultErrorMessages[code]).toBeDefined()
        expect(typeof DefaultErrorMessages[code]).toBe('string')
        expect(DefaultErrorMessages[code].length).toBeGreaterThan(0)
      })
    })
  })

  describe('Error Constants', () => {
    it('should have valid error codes', () => {
      expect(typeof ErrorCodes).toBe('object')
      expect(Object.keys(ErrorCodes).length).toBeGreaterThan(0)
      
      // All codes should be strings
      Object.values(ErrorCodes).forEach(code => {
        expect(typeof code).toBe('string')
        expect(code.length).toBeGreaterThan(0)
      })
    })

    it('should have valid error severities', () => {
      expect(typeof ErrorSeverity).toBe('object')
      expect(ErrorSeverity.LOW).toBe('low')
      expect(ErrorSeverity.MEDIUM).toBe('medium')
      expect(ErrorSeverity.HIGH).toBe('high')
      expect(ErrorSeverity.CRITICAL).toBe('critical')
    })

    it('should have consistent status code mappings', () => {
      // Auth errors should be 401 or 403
      expect(ErrorStatusCodes.UNAUTHORIZED).toBe(401)
      expect(ErrorStatusCodes.FORBIDDEN).toBe(403)
      
      // Validation errors should be 400
      expect(ErrorStatusCodes.VALIDATION_ERROR).toBe(400)
      expect(ErrorStatusCodes.INVALID_INPUT).toBe(400)
      
      // Not found should be 404
      expect(ErrorStatusCodes.NOT_FOUND).toBe(404)
      
      // Conflicts should be 409
      expect(ErrorStatusCodes.ALREADY_EXISTS).toBe(409)
      expect(ErrorStatusCodes.RESOURCE_CONFLICT).toBe(409)
      
      // Rate limiting should be 429
      expect(ErrorStatusCodes.RATE_LIMIT_EXCEEDED).toBe(429)
      
      // Server errors should be 5xx
      expect(ErrorStatusCodes.INTERNAL_ERROR).toBe(500)
      expect(ErrorStatusCodes.DATABASE_ERROR).toBe(500)
      expect(ErrorStatusCodes.SERVICE_UNAVAILABLE).toBe(503)
      expect(ErrorStatusCodes.EXTERNAL_SERVICE_ERROR).toBe(502)
    })
  })

  describe('Type Compatibility', () => {
    it('should type all errors as AppError union', () => {
      const errors: AppError[] = [
        new ElevateApiError('test'),
        new ValidationError(z.string().safeParse(123).error!),
        new AuthenticationError(),
        new AuthorizationError(),
        new NotFoundError('User'),
        new ConflictError('Conflict'),
        new RateLimitError(10, 1000),
        new SubmissionLimitError('AMPLIFY', 1, 0),
        new FileValidationError('Invalid'),
        new ExternalServiceError('Service', 'operation'),
        new ForbiddenError(),
        new APIError('API Error', 400)
      ]

      // Should compile and all errors should be instance of ElevateApiError
      errors.forEach(error => {
        expect(error).toBeInstanceOf(ElevateApiError)
      })
    })

    it('should have proper TypeScript error code type', () => {
      // These should be valid error codes at compile time
      const validCodes: ErrorCode[] = [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'VALIDATION_ERROR',
        'NOT_FOUND',
        'INTERNAL_ERROR'
      ]

      validCodes.forEach(code => {
        expect(Object.values(ErrorCodes)).toContain(code)
      })
    })

    it('should have proper TypeScript severity level type', () => {
      // These should be valid severity levels at compile time
      const validSeverities: ErrorSeverityLevel[] = [
        'low',
        'medium',
        'high',
        'critical'
      ]

      validSeverities.forEach(severity => {
        expect(Object.values(ErrorSeverity)).toContain(severity)
      })
    })
  })
})