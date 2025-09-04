# Database Logging Best Practices

## Overview

This document outlines the secure logging practices implemented in the `@elevate/db` package to ensure PII hygiene and production-safe logging.

## Security Principles

### 1. PII Protection
- **Never log** passwords, tokens, API keys, or authentication credentials
- **Redact** email addresses, phone numbers, and IP addresses
- **Truncate** user IDs and other identifiers (show first 4 characters + asterisks)
- **Sanitize** error messages to remove sensitive data

### 2. Environment-Aware Logging
- **Production**: Errors only, minimal context
- **Development**: Enhanced logging with sanitized query previews
- **Test**: Warnings and errors only

### 3. Structured Logging
- Consistent log format with timestamp, level, and context
- Separate sensitive data from safe metadata
- Use typed logging interfaces for consistency

## Implementation

### Secure Logger Usage

```typescript
import { getSecureLogger, PIIRedactor } from '@elevate/db'

const logger = getSecureLogger()

// Safe database operation logging
logger.database({
  operation: 'SELECT',
  table: 'users',
  duration: 150,
  recordCount: 25
})

// Error logging with PII redaction
logger.error('Database query failed', error, {
  operation: 'get_user_profile',
  userId: 'user_abc1****' // Already redacted
})
```

### Database Query Wrapper

```typescript
import { withDatabaseLogging } from '@elevate/db'

// Secure query execution
const getUser = withDatabaseLogging('get_user', 'users')(() =>
  prisma.users.findUnique({
    where: { id: userId } // Parameters are never logged
  })
)
```

### Transaction Logging

```typescript
import { withDatabaseTransaction } from '@elevate/db'

const createSubmission = await withDatabaseTransaction(
  'create_submission',
  async (tx) => {
    // Transaction operations
    // Automatic logging without PII exposure
  }
)
```

## Environment Configuration

### Required Environment Variables

```bash
# Logging Level (production should use ERROR)
DB_LOG_LEVEL=ERROR|WARN|INFO|DEBUG

# Enable/disable database logging (default: true)
DB_LOGGING=true|false

# Log query duration (default: true)
DB_LOG_DURATION=true|false

# Log performance metrics (default: true)
DB_LOG_PERFORMANCE=true|false

# Maximum query length in logs (default: 200)
DB_MAX_QUERY_LOG_LENGTH=200

# Development only: log query parameters (NEVER in production)
DB_LOG_QUERY_PARAMS=false
```

### Production Configuration

```bash
# Minimal logging for production
NODE_ENV=production
DB_LOG_LEVEL=ERROR
DB_LOGGING=true
DB_LOG_QUERY_PARAMS=false
```

### Development Configuration

```bash
# Enhanced logging for development
NODE_ENV=development
DB_LOG_LEVEL=DEBUG
DB_LOGGING=true
DB_LOG_QUERY_PARAMS=false  # Still false for security
```

## PII Redaction Patterns

### Automatic Redaction

The `PIIRedactor` class automatically handles:

- **Email addresses**: `user@example.com` → `[EMAIL_REDACTED]`
- **Phone numbers**: `+1-555-123-4567` → `[PHONE_REDACTED]`
- **IP addresses**: `192.168.1.1` → `[IP_REDACTED]`
- **Tokens/Keys**: `secret: abc123...` → `secret: [SENSITIVE_REDACTED]`
- **User IDs**: `user_abcd1234efgh` → `user_abcd****`

### SQL Query Sanitization

```typescript
// Before: SELECT * FROM users WHERE email = $1 AND id = $2
// After: SELECT users [QUERY_SANITIZED]
const sanitized = PIIRedactor.sanitizeSQLQuery(query)
```

### Error Message Cleaning

```typescript
const safeError = PIIRedactor.sanitizeError(error)
// Removes PII from error messages and stack traces
```

## What Gets Logged

### ✅ Safe to Log

- Operation type (SELECT, INSERT, UPDATE, DELETE)
- Table names (non-sensitive)
- Query duration and performance metrics
- Record counts
- Error types and sanitized messages
- Database connection status

### ❌ Never Log

- Actual query parameters (user IDs, emails, names)
- Full SQL queries with data
- Password fields or authentication tokens
- Raw error objects with stack traces
- User input data
- Session tokens or API keys

### ⚠️ Conditional Logging

- Query previews: Only in development, sanitized
- Stack traces: Only in development, PII-redacted
- Detailed context: Based on log level configuration

## Log Levels

### ERROR (Production Default)
- Database connection failures
- Query execution errors
- Transaction rollbacks
- Critical system errors

### WARN
- Slow query warnings (>5 seconds)
- Deprecated feature usage
- Connection pool warnings
- Performance degradation alerts

### INFO
- Database connection established
- Migration completions
- Scheduled maintenance operations
- Health check results

### DEBUG (Development Default)
- Query execution summaries
- Performance metrics
- Cache hit/miss rates
- Connection pool statistics

## Monitoring & Alerting

### Production Monitoring

```typescript
// Example log parsing for monitoring
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "ERROR",
  "service": "elevate-db",
  "operation": "get_user_submissions",
  "table": "submissions",
  "duration": 5000,
  "error": "Connection timeout",
  "action": "database_error"
}
```

### Key Metrics to Monitor

- **Error Rate**: Database operation failures
- **Slow Queries**: Operations > 1000ms
- **Connection Issues**: Database connectivity problems
- **PII Leakage**: Absence of redacted patterns (monitor for emails/phones in logs)

## Testing Log Security

### Unit Tests

```typescript
describe('PII Redaction', () => {
  it('should redact email addresses', () => {
    const input = 'User email: john@example.com submitted'
    const result = PIIRedactor.redactPII(input)
    expect(result).toBe('User email: [EMAIL_REDACTED] submitted')
  })
  
  it('should sanitize SQL queries', () => {
    const query = 'SELECT * FROM users WHERE email = $1'
    const result = PIIRedactor.sanitizeSQLQuery(query)
    expect(result).not.toContain('john@example.com')
  })
})
```

### Integration Tests

```typescript
describe('Secure Logging Integration', () => {
  it('should not log sensitive data in production', () => {
    process.env.NODE_ENV = 'production'
    const consoleSpy = jest.spyOn(console, 'log')
    
    // Execute database operation
    await getUserProfile('user_sensitive_id')
    
    // Verify no PII in logs
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('user_sensitive_id')
    )
  })
})
```

## Compliance

### GDPR Considerations
- No personal data logged without consent
- Right to be forgotten: logs don't contain identifiable data
- Data minimization: only necessary operational data logged

### SOC 2 Compliance
- Audit trail without sensitive data exposure
- Access logging for compliance reporting
- Secure logging infrastructure

## Common Anti-Patterns

### ❌ Don't Do This

```typescript
// WRONG: Logging raw user data
console.log('User data:', user)
logger.info(`Processing user ${user.email}`)

// WRONG: Logging full queries
console.log('Executing query:', query, 'with params:', params)

// WRONG: Logging errors without sanitization
logger.error('Database error:', error)
```

### ✅ Do This Instead

```typescript
// CORRECT: Using secure logging
const secureLogger = getSecureLogger()
secureLogger.database({
  operation: 'get_user',
  table: 'users',
  duration: 120
})

// CORRECT: Redacting sensitive data
secureLogger.info(`Processing user ${user.id.slice(0, 4)}****`)

// CORRECT: Sanitized error logging
secureLogger.error('Database operation failed', error, {
  operation: 'get_user_profile'
})
```

## Migration from Unsafe Logging

### Step 1: Replace Direct Console Logging

```typescript
// Before
console.log('Query executed:', query)

// After
const logger = getSecureLogger()
logger.database({ operation: 'query_executed', duration })
```

### Step 2: Use Database Wrappers

```typescript
// Before
const result = await prisma.users.findMany()

// After
const result = await withDatabaseLogging('get_users', 'users')(() =>
  prisma.users.findMany()
)
```

### Step 3: Update Error Handling

```typescript
// Before
catch (error) {
  console.error('Error:', error)
}

// After
catch (error) {
  const logger = getSecureLogger()
  logger.error('Database operation failed', error, { operation: 'get_users' })
}
```

## Troubleshooting

### Log Not Appearing
1. Check `DB_LOGGING` environment variable
2. Verify log level configuration
3. Confirm logger initialization

### PII Still Appearing in Logs
1. Update redaction patterns in `PIIRedactor`
2. Check for direct console.log statements
3. Verify production environment configuration

### Performance Impact
1. Disable detailed logging in production
2. Use async logging where possible
3. Monitor log volume and storage

## Support

For questions about secure logging practices:
1. Check this documentation first
2. Review the `logger.ts` implementation
3. Check environment configuration
4. Contact the development team for clarification

---

*This documentation is part of the MS Elevate LEAPS Tracker security guidelines. Always prioritize data protection and user privacy in logging practices.*