import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Test just the error consolidation without database dependencies
// This is a standalone test that can run without full test setup

describe('Error System - Standalone Tests', () => {
  it('should be able to import all error types from canonical source', async () => {
    // Dynamic import to test the module exports
    const errorModule = await import('@elevate/types/errors')
    
    // Test that all main error classes are available
    expect(errorModule.ElevateApiError).toBeDefined()
    expect(errorModule.ValidationError).toBeDefined()
    expect(errorModule.AuthenticationError).toBeDefined()
    expect(errorModule.AuthorizationError).toBeDefined()
    expect(errorModule.NotFoundError).toBeDefined()
    expect(errorModule.ConflictError).toBeDefined()
    expect(errorModule.RateLimitError).toBeDefined()
    expect(errorModule.SubmissionLimitError).toBeDefined()
    expect(errorModule.FileValidationError).toBeDefined()
    expect(errorModule.ExternalServiceError).toBeDefined()
    expect(errorModule.ForbiddenError).toBeDefined()
    expect(errorModule.APIError).toBeDefined()
    
    // Test that constants are available
    expect(errorModule.ErrorCodes).toBeDefined()
    expect(errorModule.ErrorSeverity).toBeDefined()
    expect(errorModule.ErrorStatusCodes).toBeDefined()
    expect(errorModule.ErrorSeverityMap).toBeDefined()
    
    // Test that factory functions are available
    expect(errorModule.createValidationError).toBeTypeOf('function')
    expect(errorModule.createAuthenticationError).toBeTypeOf('function')
    expect(errorModule.createAuthorizationError).toBeTypeOf('function')
    expect(errorModule.createNotFoundError).toBeTypeOf('function')
    expect(errorModule.createConflictError).toBeTypeOf('function')
    expect(errorModule.createRateLimitError).toBeTypeOf('function')
    
    // Test that utility functions are available
    expect(errorModule.serializeError).toBeTypeOf('function')
    expect(errorModule.isElevateApiError).toBeTypeOf('function')
    expect(errorModule.isValidationError).toBeTypeOf('function')
    expect(errorModule.validateErrorCodeUniqueness).toBeTypeOf('function')
    
    // Test that default messages are available
    expect(errorModule.DefaultErrorMessages).toBeDefined()
  })

  it('should create basic error instances', async () => {
    const { ElevateApiError, ValidationError, AuthenticationError } = await import('@elevate/types/errors')
    
    // Test basic ElevateApiError
    const baseError = new ElevateApiError('Test message', 'INVALID_INPUT')
    expect(baseError).toBeInstanceOf(Error)
    expect(baseError.name).toBe('ElevateApiError')
    expect(baseError.message).toBe('Test message')
    expect(baseError.code).toBe('INVALID_INPUT')
    expect(baseError.statusCode).toBe(400)
    
    // Test ValidationError
    const schema = z.string()
    const zodError = schema.safeParse(123).error!
    const validationError = new ValidationError(zodError)
    expect(validationError).toBeInstanceOf(ElevateApiError)
    expect(validationError.name).toBe('ValidationError')
    expect(validationError.code).toBe('VALIDATION_ERROR')
    
    // Test AuthenticationError  
    const authError = new AuthenticationError()
    expect(authError).toBeInstanceOf(ElevateApiError)
    expect(authError.name).toBe('AuthenticationError')
    expect(authError.code).toBe('UNAUTHORIZED')
    expect(authError.statusCode).toBe(401)
  })

  it('should have unique error codes', async () => {
    const { ErrorCodes, validateErrorCodeUniqueness } = await import('@elevate/types/errors')
    
    // Test that all error codes are unique
    expect(validateErrorCodeUniqueness()).toBe(true)
    
    // Test that we have expected error codes
    expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED')
    expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN')
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND')
    expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('should have consistent status code mappings', async () => {
    const { ErrorCodes, ErrorStatusCodes } = await import('@elevate/types/errors')
    
    // Test that every error code has a status mapping
    Object.values(ErrorCodes).forEach(code => {
      expect(ErrorStatusCodes[code]).toBeDefined()
      expect(typeof ErrorStatusCodes[code]).toBe('number')
      expect(ErrorStatusCodes[code]).toBeGreaterThanOrEqual(400)
      expect(ErrorStatusCodes[code]).toBeLessThanOrEqual(599)
    })
    
    // Test some specific mappings
    expect(ErrorStatusCodes.UNAUTHORIZED).toBe(401)
    expect(ErrorStatusCodes.FORBIDDEN).toBe(403) 
    expect(ErrorStatusCodes.NOT_FOUND).toBe(404)
    expect(ErrorStatusCodes.VALIDATION_ERROR).toBe(400)
    expect(ErrorStatusCodes.RATE_LIMIT_EXCEEDED).toBe(429)
    expect(ErrorStatusCodes.INTERNAL_ERROR).toBe(500)
  })

  it('should serialize errors properly', async () => {
    const { ElevateApiError, serializeError } = await import('@elevate/types/errors')
    
    const error = new ElevateApiError(
      'Test error',
      'VALIDATION_ERROR', 
      { test: 'data' },
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
    
    // Details should not be included when includeDetails is false
    expect(serialized.details).toBeUndefined()
    
    // Test with details included
    const serializedWithDetails = serializeError(error, true)
    expect(serializedWithDetails.details).toEqual({ test: 'data' })
  })

  it('should work with type guards', async () => {
    const { 
      ElevateApiError, 
      ValidationError, 
      AuthenticationError,
      isElevateApiError,
      isValidationError,
      isAuthenticationError 
    } = await import('@elevate/types/errors')
    
    const elevateError = new ElevateApiError('test')
    const validationError = new ValidationError(z.string().safeParse(123).error!)
    const authError = new AuthenticationError()
    const regularError = new Error('regular')
    
    // Test isElevateApiError
    expect(isElevateApiError(elevateError)).toBe(true)
    expect(isElevateApiError(validationError)).toBe(true) // extends ElevateApiError
    expect(isElevateApiError(authError)).toBe(true) // extends ElevateApiError
    expect(isElevateApiError(regularError)).toBe(false)
    
    // Test isValidationError
    expect(isValidationError(validationError)).toBe(true)
    expect(isValidationError(authError)).toBe(false)
    expect(isValidationError(regularError)).toBe(false)
    
    // Test isAuthenticationError
    expect(isAuthenticationError(authError)).toBe(true)
    expect(isAuthenticationError(validationError)).toBe(false)
    expect(isAuthenticationError(regularError)).toBe(false)
  })

  it('should work with factory functions', async () => {
    const { 
      createValidationError,
      createAuthenticationError,
      createNotFoundError 
    } = await import('@elevate/types/errors')
    
    // Test validation error factory
    const zodError = z.string().safeParse(123).error!
    const validationError = createValidationError(zodError, 'Custom message', 'trace_123')
    expect(validationError.message).toBe('Custom message')
    expect(validationError.traceId).toBe('trace_123')
    
    // Test authentication error factory
    const authError = createAuthenticationError('Token expired', 'trace_456')
    expect(authError.message).toBe('Token expired')
    expect(authError.traceId).toBe('trace_456')
    
    // Test not found error factory
    const notFoundError = createNotFoundError('User', '123', 'trace_789')
    expect(notFoundError.message).toBe('User with id \'123\' not found')
    expect(notFoundError.traceId).toBe('trace_789')
  })
})