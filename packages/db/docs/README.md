# @elevate/db Documentation

## Overview

This directory contains documentation for the secure database layer of the MS Elevate LEAPS Tracker.

## Documents

- **[Logging Best Practices](./LOGGING_BEST_PRACTICES.md)** - Comprehensive guide to secure logging with PII protection and environment-aware configuration

## Quick Start

The `@elevate/db` package provides a secure, PII-aware database client with structured logging:

```typescript
import { prisma, withDatabaseLogging, getSecureLogger } from '@elevate/db'

// Secure database operations with automatic logging
const getUsers = withDatabaseLogging('get_users', 'users')(() =>
  prisma.users.findMany()
)

// Direct secure logging
const logger = getSecureLogger()
logger.database({
  operation: 'CUSTOM_QUERY',
  table: 'submissions',
  duration: 150
})
```

## Security Features

- ✅ **PII Redaction**: Automatic removal of emails, IDs, and sensitive data
- ✅ **Environment-Aware**: Different log levels for dev/staging/production
- ✅ **Structured Logging**: Consistent, parseable log format
- ✅ **Query Sanitization**: SQL queries sanitized before logging
- ✅ **Error Handling**: Safe error logging without data exposure

## Configuration

See [Logging Best Practices](./LOGGING_BEST_PRACTICES.md) for complete configuration details.

### Minimal Production Setup

```bash
NODE_ENV=production
DB_LOG_LEVEL=ERROR
DB_LOGGING=true
```

### Development Setup

```bash
NODE_ENV=development
DB_LOG_LEVEL=DEBUG
DB_LOGGING=true
```

## Migration Guide

If you're migrating from unsafe logging practices:

1. Replace direct `console.log` with secure logging utilities
2. Use `withDatabaseLogging` wrapper for database operations
3. Configure appropriate environment variables
4. Test that no PII appears in logs

See the [Migration section](./LOGGING_BEST_PRACTICES.md#migration-from-unsafe-logging) for detailed steps.

## Compliance

This logging implementation supports:
- **GDPR**: No personal data logged without proper handling
- **SOC 2**: Audit trails without sensitive data exposure
- **Security Best Practices**: PII protection and data minimization

---

*Always review logs for PII leakage before deploying to production.*