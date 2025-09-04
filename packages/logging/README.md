# @elevate/logging

A comprehensive structured logging system for the MS Elevate LEAPS project, built on top of Pino for high-performance server-side logging and custom client-side logging.

## Features

- 🚀 **High Performance**: Built on Pino for server-side logging with minimal overhead
- 🌐 **Universal**: Works in both Node.js (server) and browser (client) environments
- 📊 **Structured**: All logs include contextual metadata and structured data
- 🎯 **Specialized**: Dedicated methods for APIs, database operations, authentication, webhooks, and more
- 🔒 **Security**: Automatic PII redaction and sanitization
- 📈 **Monitoring**: Built-in support for error tracking and performance monitoring
- 🧪 **Testing**: Comprehensive test coverage with Vitest

## Installation

This package is part of the Elevate monorepo and is installed via workspace dependencies:

```json
{
  "dependencies": {
    "@elevate/logging": "workspace:*"
  }
}
```

## Quick Start

### Server-side Usage

```typescript
import { getServerLogger } from '@elevate/logging/server'

const logger = getServerLogger({ name: 'my-app' })

// Basic logging
logger.info('Application started')
logger.error('Something went wrong', new Error('Database connection failed'))

// Structured logging with context
logger.info('User action completed', {
  userId: '123',
  action: 'profile_update',
  duration: 150
})

// Specialized logging
logger.api({
  method: 'POST',
  url: '/api/users',
  statusCode: 201,
  duration: 250
})

logger.database({
  operation: 'insert',
  table: 'users',
  duration: 50,
  rows: 1
})
```

### Client-side Usage

```typescript
import { getClientLogger } from '@elevate/logging/client'

const logger = getClientLogger({ name: 'my-react-app' })

// Basic logging (only in development by default)
logger.info('Component mounted')
logger.error('Form validation failed', new Error('Invalid email'))

// User interaction tracking
logger.userAction('button_click', { buttonId: 'submit', form: 'login' })

// Navigation tracking
logger.navigation('/dashboard', '/profile')

// API call tracking
logger.apiCall('GET', '/api/profile', 200, 150)
```

## Configuration

Configuration is handled through environment variables and can be overridden programmatically:

### Environment Variables

```bash
# Log level (fatal, error, warn, info, debug, trace)
LOG_LEVEL=info

# Pretty printing for development
LOG_PRETTY=true

# Fields to redact from logs (comma-separated)
LOG_REDACT=password,secret,token,key

# Logger name
LOG_NAME=elevate

# Monitoring integrations
SENTRY_DSN=https://...
LOGTAIL_TOKEN=...
```

### Programmatic Configuration

```typescript
import { createServerLogger } from '@elevate/logging/server'

const logger = createServerLogger({
  level: 'debug',
  pretty: true,
  redact: ['password', 'secret', 'customField'],
  name: 'my-custom-logger'
})
```

## Core Concepts

### Log Levels

The logger supports standard log levels in order of severity:

- **fatal**: Application is about to terminate
- **error**: Error conditions that need attention
- **warn**: Warning conditions that should be noted
- **info**: General information (default level)
- **debug**: Debug-level messages for development
- **trace**: Finest-grained information for deep debugging

### Log Context

Every log entry can include contextual information:

```typescript
interface LogContext {
  userId?: string        // Current user ID
  requestId?: string     // Request identifier
  traceId?: string       // Distributed tracing ID
  sessionId?: string     // User session ID
  action?: string        // Action being performed
  targetId?: string      // ID of the target resource
  module?: string        // Module or service name
  component?: string     // Component name (for React components)
  meta?: Record<string, unknown>  // Additional metadata
}
```

### Structured Data

The logger provides specialized methods for common logging scenarios:

#### API Logging

```typescript
logger.api({
  method: 'POST',
  url: '/api/users',
  route: '/api/users',  // Optional: clean route pattern
  statusCode: 201,
  duration: 250,
  userAgent: 'Mozilla/5.0...',
  ip: '192.168.1.1',
  size: 1024  // Response size in bytes
})
```

#### Database Logging

```typescript
logger.database({
  operation: 'query',
  table: 'users',
  query: 'SELECT * FROM users WHERE id = ?',
  params: ['123'],
  duration: 50,
  rows: 1,
  error: 'Connection timeout'  // If operation failed
})
```

#### Authentication Logging

```typescript
logger.auth({
  action: 'login',
  userId: '123',
  email: 'user@example.com',
  success: true,
  provider: 'google',
  role: 'participant',
  permissions: ['read:profile'],
  reason: 'Invalid credentials',  // If failed
  error: 'Account locked'  // If error occurred
})
```

#### Webhook Logging

```typescript
logger.webhook({
  provider: 'github',
  eventType: 'push',
  eventId: 'event-123',
  success: true,
  duration: 200,
  retryCount: 0,
  error: 'Timeout',  // If failed
  payload: { ... }   // Optional: webhook payload
})
```

#### Security Logging

```typescript
logger.security({
  event: 'csrf_violation',
  severity: 'high',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  userId: '123',
  details: {
    violation: 'Invalid token',
    endpoint: '/api/admin'
  }
})
```

#### Audit Logging

```typescript
logger.audit({
  action: 'user_updated',
  actorId: 'admin-123',
  actorType: 'user',
  targetId: 'user-456',
  targetType: 'user',
  changes: {
    name: { old: 'John', new: 'John Doe' },
    email: { old: 'old@example.com', new: 'new@example.com' }
  },
  metadata: { source: 'admin_panel' },
  success: true
})
```

#### Performance Logging

```typescript
logger.performance({
  operation: 'image_processing',
  duration: 1500,
  memory: {
    used: 1024 * 1024,    // Bytes used
    free: 512 * 1024,     // Bytes free
    total: 1536 * 1024    // Total bytes
  },
  cpu: {
    user: 1000,     // CPU time in microseconds
    system: 500
  },
  custom: {
    filesProcessed: 10,
    totalSize: 5242880
  }
})
```

## Advanced Features

### Child Loggers

Create child loggers with inherited context:

```typescript
const baseLogger = getServerLogger({ name: 'api' })
const userLogger = baseLogger.child({ userId: '123', action: 'profile_update' })

// All logs from userLogger will include userId and action
userLogger.info('Starting profile update')
userLogger.info('Profile updated successfully')
```

### Scoped Loggers

Create loggers for specific scopes:

```typescript
// Request-scoped logging
const requestLogger = logger.forRequest('req-123', 'user-456')

// Module-scoped logging
const authLogger = logger.forModule('authentication')

// Component-scoped logging (React)
const componentLogger = logger.forComponent('LoginForm')
```

### Timing and Performance

Built-in timing utilities for performance logging:

```typescript
const timer = logger.createTimer()

// Perform some operation...
await processData()

// Complete timing and log automatically
timer.complete('data_processing')

// Or handle timing manually
const endedTimer = timer.end()
logger.performance({
  operation: 'manual_timing',
  duration: endedTimer.duration!
})
```

### Error Handling

Enhanced error serialization and logging:

```typescript
try {
  await riskyOperation()
} catch (error) {
  // Automatically serializes error with stack trace
  logger.error('Operation failed', error, {
    action: 'risky_operation',
    userId: '123'
  })
  
  // Error info is structured and searchable
  // {
  //   name: 'TypeError',
  //   message: 'Cannot read property...',
  //   stack: 'TypeError: Cannot read property...\n    at ...',
  //   context: { action: 'risky_operation', userId: '123' }
  // }
}
```

## React Integration

### Error Boundary

Use the provided Error Boundary component:

```tsx
import { ErrorBoundary } from '@elevate/ui/components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary onError={(error, errorInfo) => {
      // Custom error handling
      console.error('App error:', error, errorInfo)
    }}>
      <MyApplication />
    </ErrorBoundary>
  )
}
```

### Higher-Order Component

Wrap components with error boundaries:

```tsx
import { withErrorBoundary } from '@elevate/ui/components/ErrorBoundary'

const SafeComponent = withErrorBoundary(MyComponent, 
  <div>Something went wrong</div>,  // Custom fallback
  (error, errorInfo) => {
    // Custom error handler
    trackError(error, errorInfo)
  }
)
```

### Error Reporting Hook

Manual error reporting in React:

```tsx
import { useErrorReporting } from '@elevate/ui/components/ErrorBoundary'

function MyComponent() {
  const { reportError, reportUserAction, reportNavigation } = useErrorReporting()
  
  const handleSubmit = async () => {
    try {
      await submitForm()
      reportUserAction('form_submit', { form: 'contact' })
    } catch (error) {
      reportError(error, { form: 'contact', action: 'submit' })
    }
  }
  
  return <form onSubmit={handleSubmit}>...</form>
}
```

## Security and Privacy

### Automatic PII Redaction

Sensitive fields are automatically redacted from logs:

```typescript
// Default redacted fields:
const DEFAULT_REDACT_FIELDS = [
  'password', 'secret', 'token', 'key',
  'authorization', 'auth', 'cookie', 'session',
  'apiKey', 'api_key', 'client_secret',
  'access_token', 'refresh_token', 'jwt',
  'privateKey', 'private_key', 'credentials',
  'ssn', 'social_security', 'credit_card',
  'card_number', 'cvv', 'pin'
]

// Custom redaction
logger.info('User data', {
  name: 'John Doe',
  password: 'secret123',  // Will be [REDACTED]
  customSecret: 'hidden'  // Configure via LOG_REDACT env var
})
```

### Safe Client-Side Logging

Client-side logs include protection against XSS and data leakage:

```typescript
// Only logs in development by default
// Sanitizes sensitive data before sending to server
// Includes rate limiting to prevent log flooding
```

## Monitoring Integration

### Error Tracking

Built-in support for error monitoring services:

```typescript
// Automatic Sentry integration
logger.error('Critical error', error)  // Automatically sent to Sentry

// Custom monitoring
logger.security({
  event: 'suspicious_activity',
  severity: 'critical',  // Triggers alerts
  details: { ... }
})
```

### Performance Monitoring

```typescript
// System health monitoring
logger.systemHealth()  // Logs memory, CPU, uptime

// Custom metrics
logger.performance({
  operation: 'cache_hit_rate',
  duration: 0,  // Not time-based
  custom: {
    hits: 95,
    misses: 5,
    ratio: 0.95
  }
})
```

## Testing

The package includes comprehensive test utilities:

```typescript
import { createTestLogger } from '@elevate/logging/testing'

describe('My API', () => {
  let logger: TestLogger
  
  beforeEach(() => {
    logger = createTestLogger()
  })
  
  it('should log API requests', () => {
    myApiHandler(logger)
    
    expect(logger.getLogs('info')).toContainEqual(
      expect.objectContaining({
        message: 'API request completed',
        context: expect.objectContaining({
          method: 'GET',
          statusCode: 200
        })
      })
    )
  })
})
```

## Best Practices

### 1. Use Appropriate Log Levels

- **fatal**: Application crashes, unrecoverable errors
- **error**: Errors that need attention but don't crash the app
- **warn**: Deprecated features, configuration issues, recoverable errors
- **info**: Normal application flow, business events
- **debug**: Detailed flow information for development
- **trace**: Very detailed information, typically only enabled for specific debugging

### 2. Include Meaningful Context

```typescript
// ❌ Bad
logger.error('Update failed')

// ✅ Good
logger.error('User profile update failed', error, {
  userId: '123',
  action: 'profile_update',
  fields: ['name', 'email'],
  validationErrors: ['email format invalid']
})
```

### 3. Use Specialized Methods

```typescript
// ❌ Generic
logger.info('API call completed', { method: 'GET', status: 200, time: 150 })

// ✅ Specialized
logger.api({
  method: 'GET',
  url: '/api/users',
  statusCode: 200,
  duration: 150
})
```

### 4. Structure Your Logs

```typescript
// ❌ Unstructured
logger.info('User john@example.com logged in successfully from IP 192.168.1.1 using google provider')

// ✅ Structured
logger.auth({
  action: 'login',
  userId: 'user-123',
  email: 'john@example.com',
  success: true,
  provider: 'google'
}, {
  ip: '192.168.1.1',
  userAgent: request.headers['user-agent']
})
```

### 5. Handle Errors Consistently

```typescript
// ❌ Inconsistent
try {
  await operation()
} catch (err) {
  console.error('Error:', err.message)
  throw err
}

// ✅ Consistent
try {
  await operation()
} catch (error) {
  logger.error('Operation failed', error, {
    action: 'data_processing',
    userId,
    operationId
  })
  throw error
}
```

### 6. Use Child Loggers for Context

```typescript
// ❌ Repetitive context
logger.info('Request started', { userId: '123', requestId: 'req-456' })
logger.info('Validation passed', { userId: '123', requestId: 'req-456' })
logger.info('Database updated', { userId: '123', requestId: 'req-456' })

// ✅ Child logger
const requestLogger = logger.child({ userId: '123', requestId: 'req-456' })
requestLogger.info('Request started')
requestLogger.info('Validation passed')
requestLogger.info('Database updated')
```

### 7. Monitor Performance Impact

```typescript
// ❌ Expensive operations in logs
logger.debug('Complex data', JSON.stringify(hugeObject))

// ✅ Conditional logging
if (logger.isLevelEnabled('debug')) {
  logger.debug('Complex data', { summary: summarize(hugeObject) })
}
```

## Migration from Console Logging

When migrating from console logging, use this mapping:

```typescript
// console.log → logger.info
console.log('User created')
logger.info('User created', { userId, action: 'user_creation' })

// console.error → logger.error
console.error('Database error:', error)
logger.error('Database operation failed', error, { operation: 'insert', table: 'users' })

// console.warn → logger.warn
console.warn('Deprecated API used')
logger.warn('Deprecated API endpoint accessed', { endpoint: '/api/v1/users', userId })

// console.debug → logger.debug
console.debug('Processing user data')
logger.debug('User data processing started', { userId, step: 'validation' })
```

## Troubleshooting

### Logger Not Working in Production

```typescript
// Check if logger is properly initialized
if (!logger) {
  console.error('Logger not initialized')
  return
}

// Check log level configuration
if (!logger.isLevelEnabled('info')) {
  console.warn('Info level logging disabled')
}
```

### Client-Side Logs Not Appearing

Client-side logging is disabled in production by default. To enable:

```typescript
const logger = createClientLogger({
  level: 'info',
  // Override the production check
  enabled: true
})
```

### Performance Issues

```typescript
// Use conditional logging for expensive operations
if (logger.isLevelEnabled('debug')) {
  logger.debug('Expensive operation', { data: processExpensiveData() })
}

// Use lazy evaluation
logger.debug(() => `Expensive calculation: ${expensiveCalculation()}`)
```

## Contributing

When contributing to the logging package:

1. Add tests for new features
2. Update TypeScript types
3. Document new log methods
4. Consider backward compatibility
5. Update this README

## License

Part of the MS Elevate LEAPS project.