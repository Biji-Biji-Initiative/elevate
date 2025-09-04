# Logging Best Practices - MS Elevate LEAPS

This guide provides specific logging best practices for the MS Elevate LEAPS project, including code examples and common patterns.

## Table of Contents

- [Quick Start](#quick-start)
- [API Route Logging](#api-route-logging)
- [Database Operation Logging](#database-operation-logging)
- [Authentication and Authorization](#authentication-and-authorization)
- [Webhook Processing](#webhook-processing)
- [Error Handling](#error-handling)
- [Performance Monitoring](#performance-monitoring)
- [Security Events](#security-events)
- [React Component Logging](#react-component-logging)
- [Testing with Logs](#testing-with-logs)
- [Production Considerations](#production-considerations)

## Quick Start

### Setting Up Logging in API Routes

```typescript
// apps/web/app/api/example/route.ts
import { getServerLogger } from '@elevate/logging/server'
import { NextRequest, NextResponse } from 'next/server'

const logger = getServerLogger({ name: 'api-example' })

export async function GET(request: NextRequest) {
  const requestLogger = logger.forRequestWithHeaders(request)
  
  try {
    requestLogger.info('Processing example request', {
      action: 'example_get'
    })
    
    const result = await getExampleData()
    
    requestLogger.info('Example request completed successfully', {
      action: 'example_get',
      resultCount: result.length
    })
    
    return NextResponse.json({ data: result })
  } catch (error) {
    requestLogger.error('Example request failed', error, {
      action: 'example_get'
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Setting Up Logging in React Components

```tsx
// apps/web/components/ExampleComponent.tsx
import { useErrorReporting } from '@elevate/ui/components/ErrorBoundary'
import { useEffect } from 'react'

export function ExampleComponent() {
  const { reportUserAction, reportError } = useErrorReporting()
  
  useEffect(() => {
    reportUserAction('component_mounted', { 
      component: 'ExampleComponent' 
    })
  }, [])
  
  const handleSubmit = async () => {
    try {
      reportUserAction('form_submit_started', { 
        form: 'example_form' 
      })
      
      await submitData()
      
      reportUserAction('form_submit_completed', { 
        form: 'example_form' 
      })
    } catch (error) {
      reportError(error, { 
        action: 'form_submit',
        form: 'example_form' 
      })
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* form content */}
    </form>
  )
}
```

## API Route Logging

### Standard API Route Pattern

```typescript
// apps/web/app/api/submissions/route.ts
import { getServerLogger } from '@elevate/logging/server'
import { withApiErrorHandling } from '@elevate/types'
import { prisma } from '@elevate/db/client'

const logger = getServerLogger({ name: 'submissions-api' })

export const GET = withApiErrorHandling(async (request: NextRequest, context) => {
  const requestLogger = logger.forRequest(context.traceId, context.userId)
  
  requestLogger.info('Fetching submissions', {
    action: 'submissions_fetch',
    traceId: context.traceId
  })
  
  const submissions = await prisma.submission.findMany({
    where: { user_id: context.userId }
  })
  
  requestLogger.info('Submissions fetched successfully', {
    action: 'submissions_fetch',
    count: submissions.length,
    traceId: context.traceId
  })
  
  return createSuccessResponse(submissions)
})

export const POST = withApiErrorHandling(async (request: NextRequest, context) => {
  const requestLogger = logger.forRequest(context.traceId, context.userId)
  const body = await request.json()
  
  requestLogger.info('Creating new submission', {
    action: 'submission_create',
    activityCode: body.activityCode,
    traceId: context.traceId
  })
  
  const submission = await prisma.submission.create({
    data: {
      user_id: context.userId,
      activity_code: body.activityCode,
      payload: body.payload
    }
  })
  
  requestLogger.info('Submission created successfully', {
    action: 'submission_create',
    submissionId: submission.id,
    activityCode: body.activityCode,
    traceId: context.traceId
  })
  
  return createSuccessResponse({ id: submission.id })
})
```

### API Error Handling

```typescript
// Use structured error responses with logging
import { createErrorResponse } from '@elevate/auth/server-helpers'

export const PUT = withApiErrorHandling(async (request: NextRequest, context) => {
  const requestLogger = logger.forRequest(context.traceId, context.userId)
  
  try {
    // ... operation logic
  } catch (error) {
    if (error instanceof ValidationError) {
      requestLogger.warn('Validation error in submission update', {
        action: 'submission_update',
        validationErrors: error.details,
        traceId: context.traceId
      })
      return createErrorResponse(error, 400, { traceId: context.traceId })
    }
    
    requestLogger.error('Unexpected error in submission update', error, {
      action: 'submission_update',
      traceId: context.traceId
    })
    
    throw error // Let withApiErrorHandling handle it
  }
})
```

## Database Operation Logging

### Using withDatabaseLogging Wrapper

```typescript
import { prisma, withDatabaseLogging } from '@elevate/db/client'

// Wrap database operations for automatic logging
export async function createUser(userData: CreateUserData, context: LogContext) {
  return withDatabaseLogging('create', 'users', context)(async () => {
    return await prisma.user.create({
      data: userData
    })
  })
}

export async function getUserSubmissions(userId: string, context: LogContext) {
  return withDatabaseLogging('query', 'submissions', context)(async () => {
    const submissions = await prisma.submission.findMany({
      where: { user_id: userId },
      include: { activity: true }
    })
    
    return submissions
  })
}
```

### Complex Database Operations

```typescript
export async function updateUserPoints(
  userId: string, 
  pointsDelta: number, 
  reason: string,
  context: LogContext
) {
  const dbLogger = logger.forModule('database')
  
  return await prisma.$transaction(async (tx) => {
    dbLogger.info('Starting points update transaction', {
      ...context,
      action: 'points_update_start',
      userId,
      pointsDelta,
      reason
    })
    
    // Update user points
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { 
        points: { increment: pointsDelta }
      }
    })
    
    // Record in points ledger
    await tx.pointsLedger.create({
      data: {
        user_id: userId,
        delta_points: pointsDelta,
        source: 'manual',
        description: reason
      }
    })
    
    dbLogger.info('Points update transaction completed', {
      ...context,
      action: 'points_update_complete',
      userId,
      newTotal: updatedUser.points,
      pointsDelta
    })
    
    return updatedUser
  })
}
```

## Authentication and Authorization

### Login/Logout Events

```typescript
// packages/auth/src/server-helpers.ts
import { authLogger } from '@elevate/auth/server-helpers'

export async function handleUserLogin(
  user: AuthUser, 
  provider: string, 
  context: LogContext
) {
  authLogger.login(user.id, true, provider, {
    ...context,
    email: user.email,
    role: user.role
  })
  
  // Additional business logic...
  
  return user
}

export async function handleUserLogout(userId: string, context: LogContext) {
  authLogger.logout(userId, {
    ...context,
    action: 'user_logout'
  })
  
  // Cleanup session, etc.
}
```

### Role-based Access Control

```typescript
export function createProtectedApiHandler(
  minRole: RoleName,
  handler: (user: AuthUser, req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestLogger = logger.forRequestWithHeaders(req)
    
    try {
      const user = await requireRole(minRole)
      
      requestLogger.info('Access granted', {
        action: 'access_check',
        userId: user.id,
        userRole: user.role,
        requiredRole: minRole,
        url: req.url
      })
      
      return await handler(user, req)
    } catch (error) {
      if (error instanceof RoleError) {
        authLogger.roleCheck(
          'unknown', // userId not available
          'unknown', // user role not available
          minRole,
          false,
          {
            url: req.url,
            error: error.message
          }
        )
      }
      
      throw error
    }
  }
}
```

## Webhook Processing

### Standard Webhook Pattern

```typescript
// apps/web/app/api/webhooks/kajabi/route.ts
import { getServerLogger } from '@elevate/logging/server'

const logger = getServerLogger({ name: 'kajabi-webhook' })

export const POST = withApiErrorHandling(async (request: NextRequest, context) => {
  const webhookLogger = logger.forRequest(context.traceId)
  
  try {
    const body = await request.text()
    const signature = request.headers.get('x-kajabi-signature')
    
    webhookLogger.info('Kajabi webhook received', {
      action: 'webhook_received',
      hasSignature: !!signature,
      bodyLength: body.length
    })
    
    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      webhookLogger.security({
        event: 'webhook_signature_invalid',
        severity: 'high',
        details: {
          provider: 'kajabi',
          hasSignature: !!signature,
          ip: request.headers.get('x-forwarded-for')
        }
      })
      
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }
    
    const eventData = JSON.parse(body)
    const eventType = eventData.type
    
    webhookLogger.info('Processing Kajabi webhook', {
      action: 'webhook_processing',
      eventType,
      eventId: eventData.id
    })
    
    const result = await processKajabiEvent(eventData, webhookLogger)
    
    webhookLogger.webhook({
      provider: 'kajabi',
      eventType,
      eventId: eventData.id,
      success: true,
      duration: Date.now() - startTime
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    webhookLogger.webhook({
      provider: 'kajabi',
      eventType: 'unknown',
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    })
    
    throw error
  }
})
```

### Idempotent Webhook Processing

```typescript
async function processKajabiEvent(eventData: any, logger: Logger): Promise<ProcessResult> {
  const eventId = eventData.id
  
  // Check for duplicate processing
  const existingEvent = await prisma.kajabiEvent.findUnique({
    where: { id: eventId }
  })
  
  if (existingEvent) {
    logger.info('Duplicate webhook event detected', {
      action: 'webhook_duplicate',
      eventId,
      eventType: eventData.type,
      previousProcessedAt: existingEvent.processed_at
    })
    
    return { success: true, reason: 'already_processed' }
  }
  
  // Process the event...
  const result = await handleEventLogic(eventData)
  
  // Record successful processing
  await prisma.kajabiEvent.create({
    data: {
      id: eventId,
      payload: eventData,
      processed_at: new Date()
    }
  })
  
  logger.info('Webhook event processed successfully', {
    action: 'webhook_processed',
    eventId,
    eventType: eventData.type,
    result
  })
  
  return result
}
```

## Error Handling

### Centralized Error Handling

```typescript
// packages/types/src/error-utils.ts - Enhanced with logging
import { getServerLogger } from '@elevate/logging/server'

const logger = getServerLogger({ name: 'error-handler' })

export function withApiErrorHandling<T extends any[]>(
  handler: (request: NextRequest, context: ErrorContext, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const traceId = generateTraceId()
    const context: ErrorContext = { traceId }
    
    try {
      return await handler(request, context, ...args)
    } catch (error) {
      logger.error('Unhandled API error', error as Error, {
        traceId,
        url: request.url,
        method: request.method,
        userAgent: request.headers.get('user-agent')
      })
      
      if (error instanceof ElevateApiError) {
        return createErrorResponse(error, undefined, traceId)
      }
      
      return createErrorResponse(
        new ElevateApiError('INTERNAL_ERROR', 'Internal server error', undefined, traceId),
        undefined,
        traceId
      )
    }
  }
}
```

### Custom Error Types with Logging

```typescript
export class SubmissionError extends ElevateApiError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    traceId?: string
  ) {
    super('SUBMISSION_ERROR', message, details, traceId)
    
    // Log submission-specific errors
    logger.error('Submission error occurred', this, {
      action: 'submission_error',
      traceId,
      details
    })
  }
}

export class QuotaExceededError extends ElevateApiError {
  constructor(
    resource: string,
    limit: number,
    current: number,
    traceId?: string
  ) {
    super(
      'QUOTA_EXCEEDED',
      `${resource} quota exceeded (${current}/${limit})`,
      { resource, limit, current },
      traceId
    )
    
    logger.warn('Quota exceeded', {
      action: 'quota_exceeded',
      resource,
      limit,
      current,
      traceId
    })
  }
}
```

## Performance Monitoring

### API Performance Tracking

```typescript
export const GET = withApiErrorHandling(async (request: NextRequest, context) => {
  const timer = logger.createTimer()
  const requestLogger = logger.forRequest(context.traceId)
  
  try {
    // Track different phases
    const dbTimer = logger.createTimer()
    const data = await fetchDataFromDatabase()
    dbTimer.complete('database_query')
    
    const processTimer = logger.createTimer()
    const processedData = await processData(data)
    processTimer.complete('data_processing')
    
    const serializationTimer = logger.createTimer()
    const response = NextResponse.json(processedData)
    serializationTimer.complete('response_serialization')
    
    timer.complete('api_request_total')
    
    return response
  } catch (error) {
    timer.complete('api_request_failed')
    throw error
  }
})
```

### System Health Monitoring

```typescript
// apps/web/app/api/health/route.ts
import { getServerLogger } from '@elevate/logging/server'

const logger = getServerLogger({ name: 'health-check' })

export async function GET() {
  const healthLogger = logger.forModule('health-check')
  
  try {
    // Log system health metrics
    healthLogger.systemHealth()
    
    // Check database connectivity
    const dbTimer = logger.createTimer()
    await prisma.$queryRaw`SELECT 1`
    const dbTiming = dbTimer.end()
    
    healthLogger.info('Database health check passed', {
      action: 'health_check',
      component: 'database',
      responseTime: dbTiming.duration
    })
    
    // Check external services
    const kajabiTimer = logger.createTimer()
    const kajabiHealthy = await checkKajabiHealth()
    const kajabiTiming = kajabiTimer.end()
    
    healthLogger.info('Kajabi health check completed', {
      action: 'health_check',
      component: 'kajabi',
      healthy: kajabiHealthy,
      responseTime: kajabiTiming.duration
    })
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: { healthy: true, responseTime: dbTiming.duration },
        kajabi: { healthy: kajabiHealthy, responseTime: kajabiTiming.duration }
      }
    })
    
  } catch (error) {
    healthLogger.error('Health check failed', error, {
      action: 'health_check_failed'
    })
    
    return NextResponse.json(
      { status: 'unhealthy', error: 'Health check failed' },
      { status: 503 }
    )
  }
}
```

## Security Events

### CSRF Protection Logging

```typescript
// packages/security/src/csrf.ts
import { getServerLogger } from '@elevate/logging/server'

const logger = getServerLogger({ name: 'csrf-protection' })

export function validateCSRFToken(request: NextRequest, expectedToken: string): boolean {
  const providedToken = request.headers.get('x-csrf-token')
  
  if (!providedToken) {
    logger.security({
      event: 'csrf_token_missing',
      severity: 'medium',
      ip: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
      details: {
        url: request.url,
        method: request.method
      }
    })
    
    return false
  }
  
  const isValid = providedToken === expectedToken
  
  if (!isValid) {
    logger.security({
      event: 'csrf_token_invalid',
      severity: 'high',
      ip: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
      details: {
        url: request.url,
        method: request.method,
        providedToken: providedToken.substring(0, 8) + '...' // Log partial token
      }
    })
  }
  
  return isValid
}
```

### Rate Limiting Events

```typescript
// packages/security/src/rate-limiting.ts
export async function checkRateLimit(
  identifier: string,
  limit: number,
  window: number,
  request: NextRequest
): Promise<RateLimitResult> {
  const current = await getCurrentRequestCount(identifier, window)
  
  if (current >= limit) {
    logger.security({
      event: 'rate_limit_exceeded',
      severity: 'medium',
      ip: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
      details: {
        identifier,
        limit,
        current,
        window,
        url: request.url
      }
    })
    
    return {
      allowed: false,
      current,
      limit,
      resetTime: Date.now() + (window * 1000)
    }
  }
  
  return { allowed: true, current: current + 1, limit, resetTime: null }
}
```

## React Component Logging

### Component Lifecycle Logging

```tsx
import { useErrorReporting } from '@elevate/ui/components/ErrorBoundary'
import { useEffect, useState } from 'react'

export function SubmissionForm({ activityCode }: { activityCode: string }) {
  const { reportUserAction, reportError } = useErrorReporting()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  useEffect(() => {
    reportUserAction('form_mounted', { 
      component: 'SubmissionForm',
      activityCode 
    })
    
    return () => {
      reportUserAction('form_unmounted', { 
        component: 'SubmissionForm',
        activityCode 
      })
    }
  }, [activityCode, reportUserAction])
  
  const handleSubmit = async (formData: FormData) => {
    const actionId = `submit_${Date.now()}`
    
    reportUserAction('form_submit_started', {
      component: 'SubmissionForm',
      activityCode,
      actionId,
      hasFiles: formData.has('files')
    })
    
    setIsSubmitting(true)
    
    try {
      const result = await submitForm(formData)
      
      reportUserAction('form_submit_completed', {
        component: 'SubmissionForm',
        activityCode,
        actionId,
        submissionId: result.id
      })
      
    } catch (error) {
      reportError(error, {
        component: 'SubmissionForm',
        action: 'form_submit',
        activityCode,
        actionId
      })
      
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* form content */}
    </form>
  )
}
```

### User Interaction Tracking

```tsx
export function LeaderboardTable() {
  const { reportUserAction } = useErrorReporting()
  
  const handleSort = (column: string, direction: 'asc' | 'desc') => {
    reportUserAction('leaderboard_sorted', {
      component: 'LeaderboardTable',
      sortColumn: column,
      sortDirection: direction
    })
  }
  
  const handleFilter = (filters: Record<string, any>) => {
    reportUserAction('leaderboard_filtered', {
      component: 'LeaderboardTable',
      activeFilters: Object.keys(filters),
      filterCount: Object.keys(filters).length
    })
  }
  
  const handleUserClick = (userId: string, userRank: number) => {
    reportUserAction('leaderboard_user_clicked', {
      component: 'LeaderboardTable',
      userId,
      userRank,
      viewType: 'leaderboard'
    })
  }
  
  return (
    <div>
      {/* table implementation */}
    </div>
  )
}
```

## Testing with Logs

### Testing API Endpoints

```typescript
// __tests__/api/submissions.test.ts
import { createMockLogger, MockLogger } from '@elevate/logging/testing'
import { GET } from '../../../app/api/submissions/route'

describe('Submissions API', () => {
  let mockLogger: MockLogger
  
  beforeEach(() => {
    mockLogger = createMockLogger()
    // Mock the logger import
    vi.mock('@elevate/logging/server', () => ({
      getServerLogger: () => mockLogger
    }))
  })
  
  it('should log submission fetch events', async () => {
    const request = new NextRequest('http://localhost/api/submissions')
    
    await GET(request)
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Fetching submissions',
      expect.objectContaining({
        action: 'submissions_fetch'
      })
    )
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Submissions fetched successfully',
      expect.objectContaining({
        action: 'submissions_fetch',
        count: expect.any(Number)
      })
    )
  })
  
  it('should log errors during submission fetch', async () => {
    // Mock database error
    vi.mocked(prisma.submission.findMany).mockRejectedValueOnce(
      new Error('Database connection failed')
    )
    
    const request = new NextRequest('http://localhost/api/submissions')
    
    await expect(GET(request)).rejects.toThrow('Database connection failed')
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Submissions fetch failed',
      expect.any(Error),
      expect.objectContaining({
        action: 'submissions_fetch'
      })
    )
  })
})
```

### Testing React Components

```typescript
// __tests__/components/SubmissionForm.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react'
import { SubmissionForm } from '../SubmissionForm'

// Mock the error reporting hook
const mockReportUserAction = vi.fn()
const mockReportError = vi.fn()

vi.mock('@elevate/ui/components/ErrorBoundary', () => ({
  useErrorReporting: () => ({
    reportUserAction: mockReportUserAction,
    reportError: mockReportError
  })
}))

describe('SubmissionForm', () => {
  beforeEach(() => {
    mockReportUserAction.mockClear()
    mockReportError.mockClear()
  })
  
  it('should log form mount and submit events', async () => {
    const { getByRole } = render(<SubmissionForm activityCode="LEARN" />)
    
    // Check mount event
    expect(mockReportUserAction).toHaveBeenCalledWith('form_mounted', {
      component: 'SubmissionForm',
      activityCode: 'LEARN'
    })
    
    // Submit form
    fireEvent.click(getByRole('button', { name: /submit/i }))
    
    await waitFor(() => {
      expect(mockReportUserAction).toHaveBeenCalledWith(
        'form_submit_started',
        expect.objectContaining({
          component: 'SubmissionForm',
          activityCode: 'LEARN'
        })
      )
    })
  })
  
  it('should log errors during form submission', async () => {
    // Mock API failure
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
    
    const { getByRole } = render(<SubmissionForm activityCode="LEARN" />)
    
    fireEvent.click(getByRole('button', { name: /submit/i }))
    
    await waitFor(() => {
      expect(mockReportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          component: 'SubmissionForm',
          action: 'form_submit',
          activityCode: 'LEARN'
        })
      )
    })
  })
})
```

## Production Considerations

### Environment Configuration

```bash
# Production environment variables
NODE_ENV=production
LOG_LEVEL=info
LOG_PRETTY=false
LOG_REDACT=password,secret,token,key,authorization,api_key,client_secret

# Monitoring integrations
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
LOGTAIL_TOKEN=your-logtail-token

# Optional: Custom log shipping
LOG_ENDPOINT=https://your-log-aggregator.com/logs
```

### Log Aggregation Setup

```typescript
// Custom log shipping (optional)
import { getServerLogger } from '@elevate/logging/server'

const logger = getServerLogger({
  name: 'elevate-production',
  // Custom transport for log aggregation
  transport: {
    target: '@logtail/pino',
    options: {
      sourceToken: process.env.LOGTAIL_TOKEN,
      
    }
  }
})
```

### Performance Optimization

```typescript
// Conditional expensive logging
if (logger.isLevelEnabled('debug')) {
  logger.debug('Detailed user data', {
    userData: sanitizeForLogging(complexUserObject)
  })
}

// Lazy logging with functions
logger.debug(() => `Expensive calculation: ${expensiveFunction()}`)

// Batch logging for high-volume operations
const logBatch: LogEntry[] = []

for (const item of largeDataSet) {
  // Process item...
  
  if (logBatch.length >= 100) {
    logger.info('Processed batch', { 
      batchSize: logBatch.length,
      totalProcessed: processedCount
    })
    logBatch.length = 0
  }
}
```

### Monitoring and Alerting

```typescript
// Set up alerts for critical errors
logger.fatal('Application shutting down', shutdownReason, {
  action: 'application_shutdown',
  uptime: process.uptime(),
  memoryUsage: process.memoryUsage()
})

// High-severity security events trigger alerts
logger.security({
  event: 'multiple_failed_logins',
  severity: 'critical',
  details: {
    userId,
    attemptCount: failedAttempts,
    timeWindow: '5 minutes'
  }
})

// Performance degradation alerts
logger.performance({
  operation: 'database_query_slow',
  duration: queryTime,
  custom: {
    threshold: SLOW_QUERY_THRESHOLD,
    query: sanitizedQuery
  }
})
```

## Common Patterns and Recipes

### Request Context Propagation

```typescript
// Middleware for request context
export function createRequestContext(request: NextRequest) {
  const traceId = generateTraceId()
  const requestId = generateRequestId()
  
  return {
    traceId,
    requestId,
    ip: extractClientIP(request),
    userAgent: request.headers.get('user-agent'),
    url: request.url,
    method: request.method
  }
}

// Use in API routes
export const POST = withApiErrorHandling(async (request, context) => {
  const requestContext = createRequestContext(request)
  const logger = getServerLogger().child(requestContext)
  
  // All logs will include trace ID, request ID, etc.
  logger.info('Processing request')
  
  return await processRequest(request, logger)
})
```

### Audit Trail Pattern

```typescript
export async function updateUserRole(
  targetUserId: string,
  newRole: RoleName,
  actorUserId: string,
  reason: string
) {
  const auditLogger = logger.forModule('audit')
  
  const oldUser = await prisma.user.findUnique({
    where: { id: targetUserId }
  })
  
  if (!oldUser) {
    throw new Error('User not found')
  }
  
  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole }
  })
  
  // Log the audit event
  auditLogger.audit({
    action: 'user_role_updated',
    actorId: actorUserId,
    actorType: 'user',
    targetId: targetUserId,
    targetType: 'user',
    changes: {
      role: { old: oldUser.role, new: newRole }
    },
    metadata: { reason },
    success: true
  })
  
  return updatedUser
}
```

This best practices guide provides comprehensive patterns for implementing structured logging throughout the MS Elevate LEAPS project. Remember to adapt these patterns to your specific use cases while maintaining consistency across the codebase.