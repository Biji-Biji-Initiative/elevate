# Logging Migration Plan: Console → Pino

## 📋 Executive Summary

This document outlines the migration from console-based logging to **Pino** - a high-performance Node.js logger following official best practices. The migration will provide structured logging, better performance, and production-ready logging capabilities.

**Current State:** Console logging + Database audit logs  
**Target State:** Pino structured logging + Database audit logs  
**Timeline:** 2-3 weeks implementation  
**Impact:** All packages, apps, and scripts

---

## 🔍 Current Logging Analysis

### Existing Logging Patterns

#### 1. Console Logging (Primary Method)
```typescript
// Error logging
console.error('❌ Database seeding failed:', e)
console.error('❌ Environment validation failed!')

// Info logging  
console.log('Connection successful:', result)
console.log('✅ Application created successfully!')

// Debug logging
console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...')
```

#### 2. Database Audit Logging (Structured)
```typescript
await prisma.auditLog.create({
  data: {
    actor_id: 'system',
    action: 'KAJABI_USER_ENROLLED',
    target_id: id,
    meta: { kajabi_contact_id: kajabiContact.id, email, name }
  }
})
```

#### 3. Error Response Handling
```typescript
export function createErrorResponse(error: unknown, fallbackStatus: number = 500)
```

### Current Coverage Analysis

| Component | Logging Coverage | Current Method |
|-----------|-----------------|----------------|
| API Routes | ✅ High | console.error + audit logs |
| Database Operations | ✅ High | console.error + audit logs |
| Authentication | ✅ High | console.error + audit logs |
| Webhooks | ✅ High | console.error + audit logs |
| Scripts | ✅ High | console.log/error |
| UI Components | ❌ Low | alert() only |
| Performance | ❌ None | No timing logs |
| Health Checks | ✅ Medium | console.log |

---

## 🎯 Migration Strategy

### Phase 1: Foundation Setup
1. Install Pino and configure base logger
2. Create shared logging utilities
3. Set up environment-based configuration

### Phase 2: Core Migration
1. Migrate API routes
2. Migrate database operations
3. Migrate authentication flows

### Phase 3: Application Migration
1. Migrate web app
2. Migrate admin app
3. Migrate scripts and utilities

### Phase 4: Enhancement
1. Add performance logging
2. Add structured error tracking
3. Add monitoring integration

---

## 🛠️ Implementation Plan

### Step 1: Install Dependencies

**Root package.json:**
```json
{
  "dependencies": {
    "pino": "^8.19.0",
    "pino-pretty": "^10.3.1"
  },
  "devDependencies": {
    "@types/pino": "^7.0.5"
  }
}
```

**Package-specific dependencies:**
- `@elevate/config`: Add pino for environment-based logging
- `@elevate/db`: Add pino for database operations
- `@elevate/auth`: Add pino for authentication flows
- `@elevate/emails`: Add pino for email operations

### Step 2: Create Shared Logging Package

**New package: `@elevate/logging`**

```typescript
// packages/logging/src/index.ts
import pino from 'pino'
import { EnvSchema } from '@elevate/config'

export interface LogContext {
  userId?: string
  requestId?: string
  action?: string
  targetId?: string
  meta?: Record<string, any>
}

export interface LoggerConfig {
  level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
  pretty: boolean
  redact: string[]
}

export class Logger {
  private pino: pino.Logger
  
  constructor(config: LoggerConfig) {
    this.pino = pino({
      level: config.level,
      transport: config.pretty ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      } : undefined,
      redact: config.redact
    })
  }

  // Standard logging methods
  fatal(msg: string, context?: LogContext): void
  error(msg: string, error?: Error, context?: LogContext): void
  warn(msg: string, context?: LogContext): void
  info(msg: string, context?: LogContext): void
  debug(msg: string, context?: LogContext): void
  trace(msg: string, context?: LogContext): void

  // Specialized methods
  api(route: string, method: string, status: number, duration: number, context?: LogContext): void
  db(operation: string, table: string, duration: number, context?: LogContext): void
  auth(action: string, userId: string, success: boolean, context?: LogContext): void
  webhook(provider: string, event: string, success: boolean, context?: LogContext): void
  audit(action: string, actorId: string, targetId: string, meta?: Record<string, any>): void
}
```

### Step 3: Environment Configuration

**Update `@elevate/config`:**
```typescript
// packages/config/src/env.ts
export const EnvSchema = z.object({
  // ... existing fields ...
  
  // Logging Configuration
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  
  LOG_PRETTY: z.string()
    .transform((val) => val === 'true' || val === '1')
    .default('false')
    .optional(),
  
  LOG_REDACT: z.string()
    .transform((val) => val.split(',').map(s => s.trim()))
    .default('password,secret,token,key')
    .optional(),
  
  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  LOGTAIL_TOKEN: z.string().optional(),
})
```

### Step 4: Database Integration

**Update `@elevate/db`:**
```typescript
// packages/db/client.ts
import { Logger } from '@elevate/logging'

const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  pretty: process.env.LOG_PRETTY === 'true',
  redact: process.env.LOG_REDACT?.split(',') || ['password', 'secret']
})

// Wrap Prisma client with logging
export const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
})

prisma.$on('query', (e) => {
  logger.db('query', 'prisma', e.duration, {
    query: e.query,
    params: e.params,
    target: e.target
  })
})

prisma.$on('error', (e) => {
  logger.error('Database error', e.error, {
    target: e.target,
    action: 'database_operation'
  })
})
```

### Step 5: API Route Migration

**Before:**
```typescript
// apps/web/app/api/health/route.ts
export async function GET() {
  try {
    console.log('Health check requested')
    // ... logic
    return NextResponse.json({ status: 'healthy' })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 })
  }
}
```

**After:**
```typescript
// apps/web/app/api/health/route.ts
import { Logger } from '@elevate/logging'

const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  pretty: process.env.LOG_PRETTY === 'true',
  redact: process.env.LOG_REDACT?.split(',') || ['password', 'secret']
})

export async function GET() {
  const startTime = Date.now()
  
  try {
    logger.info('Health check requested', { 
      action: 'health_check',
      requestId: crypto.randomUUID()
    })
    
    // ... logic
    
    const duration = Date.now() - startTime
    logger.api('/api/health', 'GET', 200, duration, {
      action: 'health_check'
    })
    
    return NextResponse.json({ status: 'healthy' })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Health check failed', error as Error, {
      action: 'health_check',
      duration
    })
    
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 })
  }
}
```

### Step 6: Authentication Migration

**Update `@elevate/auth`:**
```typescript
// packages/auth/server-helpers.ts
import { Logger } from '@elevate/logging'

const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  pretty: process.env.LOG_PRETTY === 'true',
  redact: process.env.LOG_REDACT?.split(',') || ['password', 'secret']
})

export function createErrorResponse(error: unknown, fallbackStatus: number = 500): NextResponse {
  if (error instanceof RoleError) {
    logger.warn('Role error', {
      action: 'role_validation',
      error: error.message,
      statusCode: error.statusCode
    })
    
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    )
  }
  
  if (error instanceof Error) {
    logger.error('API error', error, {
      action: 'api_request',
      statusCode: fallbackStatus
    })
    
    return NextResponse.json(
      { error: error.message },
      { status: fallbackStatus }
    )
  }
  
  logger.error('Unknown error', new Error('Unknown error occurred'), {
    action: 'api_request',
    statusCode: fallbackStatus
  })
  
  return NextResponse.json(
    { error: 'An unexpected error occurred' },
    { status: fallbackStatus }
  )
}
```

### Step 7: Webhook Migration

**Before:**
```typescript
// apps/web/app/api/webhooks/clerk/route.ts
} catch (error) {
  console.error('Error processing webhook:', error)
  return new NextResponse('Error processing webhook', { status: 500 })
}
```

**After:**
```typescript
// apps/web/app/api/webhooks/clerk/route.ts
import { Logger } from '@elevate/logging'

const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  pretty: process.env.LOG_PRETTY === 'true',
  redact: process.env.LOG_REDACT?.split(',') || ['password', 'secret']
})

} catch (error) {
  logger.error('Webhook processing failed', error as Error, {
    action: 'webhook_processing',
    provider: 'clerk',
    eventType: evt.type
  })
  
  // Still create audit log for database persistence
  await prisma.auditLog.create({
    data: {
      actor_id: 'clerk-webhook',
      action: 'WEBHOOK_ERROR',
      target_id: 'unknown',
      meta: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    }
  })
  
  return new NextResponse('Error processing webhook', { status: 500 })
}
```

### Step 8: Script Migration

**Before:**
```typescript
// scripts/clerk-auto-setup.js
console.log('========================================')
console.log('MS Elevate Indonesia - Automated Clerk Setup')
console.log('========================================')
```

**After:**
```typescript
// scripts/clerk-auto-setup.js
import { Logger } from '@elevate/logging'

const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  pretty: true, // Always pretty for scripts
  redact: process.env.LOG_REDACT?.split(',') || ['password', 'secret']
})

logger.info('Starting Clerk setup', {
  action: 'clerk_setup',
  script: 'clerk-auto-setup.js'
})
```

### Step 9: Performance Logging

**Add timing middleware:**
```typescript
// packages/auth/middleware.ts
import { Logger } from '@elevate/logging'

const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  pretty: process.env.LOG_PRETTY === 'true',
  redact: process.env.LOG_REDACT?.split(',') || ['password', 'secret']
})

export function middleware(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  logger.info('Request started', {
    action: 'request_start',
    requestId,
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent')
  })
  
  // ... existing middleware logic
  
  const duration = Date.now() - startTime
  logger.info('Request completed', {
    action: 'request_end',
    requestId,
    duration,
    status: response.status
  })
  
  return response
}
```

### Step 10: Monitoring Integration

**Add Sentry integration:**
```typescript
// packages/logging/src/sentry.ts
import * as Sentry from '@sentry/nextjs'
import { Logger } from './index'

export class SentryLogger extends Logger {
  error(msg: string, error?: Error, context?: LogContext): void {
    super.error(msg, error, context)
    
    if (error && process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: context,
        extra: context?.meta
      })
    }
  }
}
```

---

## 📊 Migration Checklist

### Phase 1: Foundation (Week 1)
- [ ] Install Pino dependencies in root and packages
- [ ] Create `@elevate/logging` package
- [ ] Update environment configuration
- [ ] Create base logger configuration
- [ ] Add TypeScript types

### Phase 2: Core Packages (Week 1-2)
- [ ] Migrate `@elevate/config` logging
- [ ] Migrate `@elevate/db` logging
- [ ] Migrate `@elevate/auth` logging
- [ ] Migrate `@elevate/emails` logging
- [ ] Update error response helpers

### Phase 3: Applications (Week 2)
- [ ] Migrate web app API routes
- [ ] Migrate admin app API routes
- [ ] Migrate middleware
- [ ] Migrate webhook handlers
- [ ] Add request timing middleware

### Phase 4: Scripts & Utilities (Week 2-3)
- [ ] Migrate deployment scripts
- [ ] Migrate setup scripts
- [ ] Migrate database scripts
- [ ] Migrate test utilities
- [ ] Update CI/CD logging

### Phase 5: Enhancement (Week 3)
- [ ] Add performance monitoring
- [ ] Add structured error tracking
- [ ] Add monitoring integration (Sentry/Logtail)
- [ ] Add log aggregation
- [ ] Create logging documentation

---

## 🎯 Success Metrics

### Performance
- **Logging overhead:** < 1ms per log entry
- **Memory usage:** < 5MB additional memory
- **Throughput:** No impact on API response times

### Functionality
- **Coverage:** 100% of current console.log/error replaced
- **Structured data:** All logs include context and metadata
- **Error tracking:** All errors properly categorized and tracked

### Monitoring
- **Observability:** All API routes, database operations, and errors logged
- **Debugging:** Easy to trace requests through the system
- **Alerting:** Critical errors trigger alerts

---

## 🚨 Risk Mitigation

### Rollback Plan
1. Keep console logging as fallback during migration
2. Feature flag to switch between console and Pino
3. Gradual rollout by package/component

### Testing Strategy
1. Unit tests for logger configuration
2. Integration tests for log output
3. Performance tests for logging overhead
4. End-to-end tests for complete request flows

### Documentation
1. Update API documentation with logging examples
2. Create logging guidelines for developers
3. Document monitoring and alerting setup

---

## 📚 Resources

### Official Pino Documentation
- [Pino Getting Started](https://getpino.io/#/docs/getting-started)
- [Pino Best Practices](https://getpino.io/#/docs/best-practices)
- [Pino API Reference](https://getpino.io/#/docs/api)

### Migration Examples
- [Node.js Console to Pino Migration](https://getpino.io/#/docs/migration)
- [Express.js Logging with Pino](https://getpino.io/#/docs/express)
- [Next.js Logging Integration](https://getpino.io/#/docs/web/frameworks/nextjs)

---

## 🎯 Next Steps

1. **Review and approve** this migration plan
2. **Set up development environment** with Pino
3. **Create `@elevate/logging` package** as foundation
4. **Begin Phase 1 implementation** with core packages
5. **Establish monitoring** and alerting infrastructure

This migration will transform our logging from basic console output to a production-ready, structured logging system that provides better observability, debugging capabilities, and monitoring integration.










