import { expect } from 'vitest'
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
  type ErrorCode,
} from '@elevate/types'

// Test utilities for error handling scenarios

/**
 * Create test error instances for testing error handling
 */
export class ErrorTestFactory {
  static createValidationError(fields: string[] = ['field1']): ValidationError {
    const zodError = new z.ZodError(
      fields.map((field) => ({
        code: 'invalid_type' as const,
        expected: 'string',
        received: 'undefined',
        path: [field],
        message: `${field} is required`,
      })),
    )
    return new ValidationError(zodError, 'Test validation error')
  }

  static createAuthenticationError(message?: string): AuthenticationError {
    return new AuthenticationError(message || 'Test authentication error')
  }

  static createAuthorizationError(message?: string): AuthorizationError {
    return new AuthorizationError(message || 'Test authorization error')
  }

  static createNotFoundError(
    resource = 'TestResource',
    id?: string,
  ): NotFoundError {
    return new NotFoundError(resource, id)
  }

  static createConflictError(message = 'Test conflict'): ConflictError {
    return new ConflictError(message)
  }

  static createRateLimitError(
    limit = 100,
    windowMs = 60000,
  ): RateLimitError {
    return new RateLimitError(limit, windowMs, 30)
  }

  static createSubmissionLimitError(
    activityType = 'Test',
    currentCount = 51,
    maxAllowed = 50,
  ): SubmissionLimitError {
    return new SubmissionLimitError(activityType, currentCount, maxAllowed)
  }

  static createFileValidationError(
    message = 'Invalid file type',
  ): FileValidationError {
    return new FileValidationError(message)
  }

  static createExternalServiceError(
    service = 'TestService',
    operation = 'test_operation',
  ): ExternalServiceError {
    return new ExternalServiceError(
      service,
      operation,
      new Error('Service unavailable'),
    )
  }

  static createCustomError(
    message: string,
    code: ErrorCode,
    details?: unknown,
  ): ElevateApiError {
    return new ElevateApiError(message, code, details)
  }
}

/**
 * Mock response helpers for testing API routes
 */
export class MockResponseHelper {
  static successResponse<T>(data: T) {
    return {
      success: true,
      data,
    }
  }

  static errorResponse(error: string, code?: string, details?: unknown) {
    const response: Record<string, unknown> = {
      success: false,
      error,
    }
    if (code) response.code = code
    if (details) response.details = details
    
    // Use string matcher signatures but keep them typed as unknown to satisfy TS without test globals
    response.timestamp = expect.any(String) as unknown
    response.traceId = expect.any(String) as unknown
    
    return response
  }

  static validationErrorResponse(fields: string[]): Record<string, unknown> {
    return {
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      // Type assertion for test matcher functions
      details: expect.arrayContaining(
        fields.map((field) =>
          expect.objectContaining({
            path: [field],
            message: expect.any(String) as unknown,
          }) as unknown,
        ),
      ) as unknown,
      timestamp: expect.any(String) as unknown,
      traceId: expect.any(String) as unknown,
    }
  }
}

/**
 * Test scenarios for common error cases
 */
export const ErrorTestScenarios = {
  // Authentication scenarios
  unauthenticated: {
    description: 'User is not authenticated',
    error: ErrorTestFactory.createAuthenticationError(),
    expectedStatus: 401,
    expectedResponse: MockResponseHelper.errorResponse(
      'Authentication required',
      'UNAUTHORIZED',
    ),
  },

  insufficientPermissions: {
    description: 'User lacks required permissions',
    error: ErrorTestFactory.createAuthorizationError(),
    expectedStatus: 403,
    expectedResponse: MockResponseHelper.errorResponse(
      'Insufficient permissions',
      'FORBIDDEN',
    ),
  },

  // Validation scenarios
  invalidRequestBody: {
    description: 'Request body validation fails',
    error: ErrorTestFactory.createValidationError(['name', 'email']),
    expectedStatus: 400,
    expectedResponse: MockResponseHelper.validationErrorResponse([
      'name',
      'email',
    ]),
  },

  missingRequiredFields: {
    description: 'Required fields are missing',
    error: ErrorTestFactory.createValidationError(['requiredField']),
    expectedStatus: 400,
    expectedResponse: MockResponseHelper.validationErrorResponse([
      'requiredField',
    ]),
  },

  // Resource scenarios
  resourceNotFound: {
    description: 'Requested resource does not exist',
    error: ErrorTestFactory.createNotFoundError('User', '123'),
    expectedStatus: 404,
    expectedResponse: MockResponseHelper.errorResponse(
      "User with id '123' not found",
      'NOT_FOUND',
    ),
  },

  resourceConflict: {
    description: 'Resource already exists',
    error: ErrorTestFactory.createConflictError(
      'User with this email already exists',
    ),
    expectedStatus: 409,
    expectedResponse: MockResponseHelper.errorResponse(
      'User with this email already exists',
      'RESOURCE_CONFLICT',
    ),
  },

  // Rate limiting scenarios
  rateLimitExceeded: {
    description: 'Rate limit has been exceeded',
    error: ErrorTestFactory.createRateLimitError(100, 60000),
    expectedStatus: 429,
    expectedResponse: MockResponseHelper.errorResponse(
      'Rate limit exceeded. Maximum 100 requests per 60000ms window',
      'RATE_LIMIT_EXCEEDED',
    ),
  },

  // Business logic scenarios
  submissionLimitExceeded: {
    description: 'Submission limit has been exceeded',
    error: ErrorTestFactory.createSubmissionLimitError('Peer training', 51, 50),
    expectedStatus: 400,
    expectedResponse: MockResponseHelper.errorResponse(
      'Peer training submission limit exceeded. Current: 51, Maximum allowed: 50',
      'SUBMISSION_LIMIT_EXCEEDED',
    ),
  },

  // File handling scenarios
  invalidFileType: {
    description: 'Uploaded file type is not allowed',
    error: ErrorTestFactory.createFileValidationError(
      'Only PDF, JPG, and PNG files are allowed',
    ),
    expectedStatus: 400,
    expectedResponse: MockResponseHelper.errorResponse(
      'Only PDF, JPG, and PNG files are allowed',
      'INVALID_FILE_TYPE',
    ),
  },

  // External service scenarios
  externalServiceError: {
    description: 'External service is unavailable',
    error: ErrorTestFactory.createExternalServiceError(
      'Kajabi',
      'webhook_processing',
    ),
    expectedStatus: 502,
    expectedResponse: MockResponseHelper.errorResponse(
      'External service error: Kajabi webhook_processing failed',
      'EXTERNAL_SERVICE_ERROR',
    ),
  },

  // Server error scenarios
  internalServerError: {
    description: 'Unexpected server error',
    error: new Error('Database connection failed'),
    expectedStatus: 500,
    expectedResponse: {
      success: false,
      error: expect.any(String) as unknown,
      code: 'INTERNAL_ERROR',
      timestamp: expect.any(String) as unknown,
      traceId: expect.any(String) as unknown,
    },
  },
}

/**
 * Helper function to test API error responses
 * Use in your test files like:
 *
 * describe('Error handling', () => {
 *   it('should handle authentication errors', async () => {
 *     const scenario = ErrorTestScenarios.unauthenticated
 *     // ... your test logic
 *     expect(response.status).toBe(scenario.expectedStatus)
 *     expect(response.body).toMatchObject(scenario.expectedResponse)
 *   })
 * })
 */
export function testErrorScenario(
  scenario: (typeof ErrorTestScenarios)[keyof typeof ErrorTestScenarios],
  response: { status: number; body: unknown },
) {
  expect(response.status).toBe(scenario.expectedStatus)
  expect(response.body).toMatchObject(scenario.expectedResponse)
}

/**
 * Generate test data for different error conditions
 */
export const TestDataGenerators = {
  invalidJson: () => '{ invalid json',

  invalidZodData: (schema: z.ZodSchema) => {
    // Return data that will fail the schema validation
    if (schema instanceof z.ZodObject) {
      return {} // Empty object will likely fail most schemas
    }
    return null
  },

  malformedFormData: () => {
    const formData = new FormData()
    formData.append('invalid', 'data')
    return formData
  },

  largePayload: (sizeInMB = 10) => {
    const size = sizeInMB * 1024 * 1024
    return 'x'.repeat(size)
  },

  sqlInjectionAttempts: () => [
    "'; DROP TABLE users; --",
    '1 OR 1=1',
    "admin' --",
    "' UNION SELECT * FROM users --",
  ],

  xssAttempts: () => [
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src="x" onerror="alert(1)">',
  ],
}

/**
 * Mock context for testing with error handling middleware
 */
export function createMockContext(
  overrides: Partial<{
    traceId: string
    startTime: number
  }> = {},
) {
  return {
    traceId: overrides.traceId || 'test-trace-id',
    startTime: overrides.startTime || Date.now(),
    request: new Request('http://localhost/test'),
  }
}
