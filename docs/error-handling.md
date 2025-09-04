# Standardized Error Handling System

This document describes the comprehensive error handling system implemented across the MS Elevate LEAPS Tracker API routes. The system provides consistent error responses, proper HTTP status codes, comprehensive logging, and testing utilities.

## Table of Contents
- [Overview](#overview)
- [Error Response Format](#error-response-format)
- [Error Types and Codes](#error-types-and-codes)
- [Usage Guide](#usage-guide)
- [Middleware](#middleware)
- [Testing](#testing)
- [Migration Guide](#migration-guide)
- [Best Practices](#best-practices)

## Overview

The standardized error handling system addresses inconsistencies in API error responses and provides:

- **Consistent Error Format**: All API errors follow the same response structure
- **Standardized Error Codes**: Predefined error codes for common scenarios
- **Proper HTTP Status Codes**: Correct status codes based on error type
- **Comprehensive Logging**: Structured error logging with trace IDs
- **Testing Utilities**: Tools for testing error scenarios
- **Type Safety**: Full TypeScript support for error handling

## Error Response Format

All API errors now return responses in this standardized format:

```typescript
interface ApiErrorResponse {
  success: false
  error: string           // Human-readable error message
  code?: string          // Standardized error code
  details?: unknown      // Additional error details (development only)
  timestamp?: string     // ISO timestamp when error occurred
  traceId?: string       // Unique trace ID for tracking
}
```

### Example Error Response

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["name"],
      "message": "Name is required"
    }
  ],
  "timestamp": "2025-01-08T10:30:00.000Z",
  "traceId": "trace_1704708600000_abc123xyz"
}
```

### Success Response Format

Success responses maintain consistency:

```typescript
interface ApiSuccessResponse<T> {
  success: true
  data: T
}
```

## Error Types and Codes

### Authentication & Authorization
- `UNAUTHORIZED` (401): User not authenticated
- `FORBIDDEN` (403): Insufficient permissions  
- `TOKEN_EXPIRED` (401): Authentication token expired
- `INVALID_CREDENTIALS` (401): Invalid login credentials

### Validation
- `VALIDATION_ERROR` (400): Request validation failed
- `INVALID_INPUT` (400): Invalid input data
- `MISSING_REQUIRED_FIELD` (400): Required field missing

### Resources
- `NOT_FOUND` (404): Resource not found
- `ALREADY_EXISTS` (409): Resource already exists
- `RESOURCE_CONFLICT` (409): Resource conflict

### Business Logic
- `SUBMISSION_LIMIT_EXCEEDED` (400): Submission limits exceeded
- `INVALID_SUBMISSION_STATUS` (400): Invalid submission status
- `POINT_ADJUSTMENT_OUT_OF_BOUNDS` (400): Point adjustment out of bounds

### Files
- `FILE_TOO_LARGE` (413): File size exceeds limit
- `INVALID_FILE_TYPE` (400): Invalid file type
- `FILE_UPLOAD_FAILED` (500): File upload failed

### Rate Limiting
- `RATE_LIMIT_EXCEEDED` (429): Rate limit exceeded

### External Services
- `EXTERNAL_SERVICE_ERROR` (502): External service error
- `WEBHOOK_VALIDATION_FAILED` (400): Webhook validation failed

### Server
- `INTERNAL_ERROR` (500): Internal server error
- `SERVICE_UNAVAILABLE` (503): Service unavailable
- `DATABASE_ERROR` (500): Database error

## Usage Guide

### Basic API Route Implementation

```typescript
import { withApiErrorHandling, createSuccessResponse, AuthenticationError } from '@elevate/types'
import { auth } from '@clerk/nextjs/server'

export const GET = withApiErrorHandling(async (request, context) => {
  const { userId } = await auth()
  
  if (!userId) {
    throw new AuthenticationError()
  }
  
  // Your business logic here
  const data = await fetchUserData(userId)
  
  return createSuccessResponse(data)
})
```

### Custom Error Handling

```typescript
import { ElevateApiError, ValidationError } from '@elevate/types'
import { z } from 'zod'

export const POST = withApiErrorHandling(async (request, context) => {
  try {
    const body = await request.json()
    const validatedData = MySchema.parse(body)
    
    // Business logic that might fail
    if (someBusinessCondition) {
      throw new ElevateApiError(
        'Business rule violation',
        'RESOURCE_CONFLICT',
        { reason: 'duplicate_entry' },
        context.traceId
      )
    }
    
    return createSuccessResponse(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error, 'Invalid request data', context.traceId)
    }
    throw error // Re-throw to be handled by withApiErrorHandling
  }
})
```

### Available Error Classes

```typescript
// Import from @elevate/types
import {
  ElevateApiError,          // Generic API error
  ValidationError,          // Zod validation errors
  AuthenticationError,      // 401 errors
  AuthorizationError,       // 403 errors
  NotFoundError,           // 404 errors
  ConflictError,           // 409 errors
  RateLimitError,          // 429 errors
  SubmissionLimitError,    // Business logic errors
  FileValidationError,     // File upload errors
  ExternalServiceError     // External service errors
} from '@elevate/types'
```

### Quick Error Helpers

```typescript
import { 
  unauthorized, 
  forbidden, 
  notFound, 
  badRequest, 
  conflict, 
  validationError,
  rateLimitExceeded 
} from '@elevate/types'

// Quick 401 response
return unauthorized('Please log in')

// Quick 404 response
return notFound('User', userId)

// Quick validation error response
return validationError(zodError, 'Invalid submission data')
```

## Middleware

### Core Error Handling Middleware

```typescript
import { withApiErrorHandling } from '@elevate/types'

export const GET = withApiErrorHandling(async (request, context) => {
  // Your handler logic
  // All errors are automatically caught and formatted
})
```

### Composable Middleware

```typescript
import { 
  compose, 
  validateBody, 
  validateQuery, 
  rateLimit, 
  securityHeaders,
  requestLogger 
} from '@elevate/types'

const MySchema = z.object({
  name: z.string(),
  email: z.string().email()
})

export const POST = compose(
  requestLogger(),
  securityHeaders(),
  rateLimit(100, 60000), // 100 requests per minute
  validateBody(MySchema)
)(async (request, context) => {
  // context.validatedBody contains parsed data
  const { name, email } = (context as any).validatedBody
  
  return createSuccessResponse({ name, email })
})
```

### Available Middleware

- `withApiErrorHandling()`: Core error handling wrapper
- `validateBody(schema)`: Request body validation
- `validateQuery(schema)`: Query parameter validation  
- `rateLimit(max, windowMs)`: Rate limiting
- `cors(options)`: CORS headers
- `securityHeaders()`: Security headers
- `requestLogger()`: Request/response logging

## Testing

### Using Test Utilities

```typescript
import { 
  ErrorTestFactory, 
  ErrorTestScenarios, 
  MockResponseHelper,
  testErrorScenario 
} from '@elevate/types/test-utils'

describe('API Error Handling', () => {
  it('should handle authentication errors', async () => {
    const response = await request(app)
      .get('/api/protected-route')
      .expect(401)
    
    expect(response.body).toMatchObject(
      MockResponseHelper.errorResponse(
        'Authentication required',
        'UNAUTHORIZED'
      )
    )
  })
  
  it('should handle validation errors', async () => {
    const response = await request(app)
      .post('/api/submissions')
      .send({ invalid: 'data' })
      .expect(400)
      
    testErrorScenario(ErrorTestScenarios.invalidRequestBody, {
      status: response.status,
      body: response.body
    })
  })
})
```

### Creating Test Errors

```typescript
import { ErrorTestFactory } from '@elevate/types/test-utils'

// Create various error types for testing
const authError = ErrorTestFactory.createAuthenticationError()
const validationError = ErrorTestFactory.createValidationError(['name', 'email'])
const notFoundError = ErrorTestFactory.createNotFoundError('User', '123')
```

### Test Scenarios

Pre-built test scenarios are available for common error conditions:

```typescript
import { ErrorTestScenarios } from '@elevate/types/test-utils'

// Available scenarios:
// - unauthenticated
// - insufficientPermissions
// - invalidRequestBody
// - missingRequiredFields
// - resourceNotFound
// - resourceConflict
// - rateLimitExceeded
// - submissionLimitExceeded
// - invalidFileType
// - externalServiceError
// - internalServerError
```

## Migration Guide

### Before (Old Error Handling)

```typescript
// Inconsistent error formats
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    
    // Business logic
    
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}
```

### After (New Error Handling)

```typescript
// Consistent, standardized error handling
export const GET = withApiErrorHandling(async (request, context) => {
  const { userId } = await auth()
  
  if (!userId) {
    throw new AuthenticationError()
  }
  
  // Business logic - validation errors are handled automatically
  
  return createSuccessResponse(result)
})
```

### Migration Steps

1. **Import new utilities**:
   ```typescript
   import { withApiErrorHandling, createSuccessResponse, AuthenticationError } from '@elevate/types'
   ```

2. **Wrap handlers with middleware**:
   ```typescript
   export const GET = withApiErrorHandling(async (request, context) => {
     // Handler logic
   })
   ```

3. **Replace error responses with error classes**:
   ```typescript
   // Old
   return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
   
   // New
   throw new AuthenticationError()
   ```

4. **Use createSuccessResponse for success cases**:
   ```typescript
   // Old
   return NextResponse.json({ success: true, data: result })
   
   // New
   return createSuccessResponse(result)
   ```

## Best Practices

### Error Handling

1. **Use specific error types**: Choose the most specific error class for your scenario
2. **Provide context**: Include relevant details in error messages and details
3. **Log errors appropriately**: Let the system handle logging with trace IDs
4. **Don't expose sensitive data**: Error details are only shown in development

### Security

1. **Validate inputs**: Use Zod schemas for request validation
2. **Handle rate limiting**: Implement appropriate rate limits for endpoints
3. **Sanitize error messages**: Don't expose internal implementation details
4. **Use trace IDs**: For debugging without exposing sensitive information

### Performance

1. **Cache error responses**: Consider caching for frequently encountered errors
2. **Monitor error rates**: Track error frequencies and patterns
3. **Optimize logging**: Balance logging detail with performance impact

### Testing

1. **Test error scenarios**: Include error cases in your test suites
2. **Use test utilities**: Leverage provided testing helpers
3. **Mock external services**: Test external service error scenarios
4. **Validate error responses**: Ensure error responses match expected format

## Error Monitoring Integration

The error handling system is designed to integrate with monitoring services:

```typescript
// In error-utils.ts, the logError function can be extended:
export function logError(error: Error, traceId: string, context?: Record<string, unknown>) {
  // Console logging (always)
  console.error('[ERROR]', { error: error.message, traceId, context })
  
  // Production monitoring integration
  if (process.env.NODE_ENV === 'production') {
    // Sentry integration
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, { 
        tags: { traceId },
        extra: context 
      })
    }
    
    // Custom monitoring service
    if (process.env.MONITORING_ENDPOINT) {
      // Send to monitoring service
    }
  }
}
```

## Conclusion

The standardized error handling system provides:

- **Consistency** across all API endpoints
- **Type safety** with comprehensive TypeScript support
- **Developer experience** with clear error messages and debugging info
- **Monitoring integration** with structured logging and trace IDs
- **Testing support** with comprehensive test utilities
- **Security** with appropriate error message handling

This system ensures that all API routes in the MS Elevate LEAPS Tracker provide consistent, secure, and debuggable error responses while maintaining excellent developer experience.