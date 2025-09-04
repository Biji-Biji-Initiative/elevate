# Security & Type System Remediation Plan
## MS Elevate LEAPS Project

### Executive Summary
This document outlines critical security vulnerabilities and type system issues discovered in the codebase audit, with a prioritized remediation plan that focuses on fixing existing issues without introducing new features or breaking changes.

---

## 🔴 CRITICAL ISSUES (Fix Immediately)

### 1. CORS Wildcard with Credentials Vulnerability
**Location**: `packages/types/src/middleware.ts:175-178`
**Issue**: Allows `origin: '*'` with `credentials: true` - enables any site to make credentialed requests
**Impact**: Cross-origin attacks, session hijacking

**Fix**:
```typescript
// packages/types/src/middleware.ts
export function cors(options: CorsOptions = {}) {
  const {
    origin = process.env.NODE_ENV === 'production' 
      ? ['https://leaps.mereka.org'] 
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials = true,
    // ...
  } = options

  return async (request: NextRequest, context: MiddlewareContext, next: MiddlewareNext) => {
    const requestOrigin = request.headers.get('origin')
    
    // Never allow wildcard with credentials
    if (origin === '*' && credentials) {
      throw new Error('CORS: Cannot use wildcard origin with credentials')
    }
    
    // Add Vary header for cache correctness
    const response = await next()
    response.headers.append('Vary', 'Origin')
    
    // Validate origin
    const allowed = Array.isArray(origin) 
      ? origin.includes(requestOrigin || '')
      : origin === requestOrigin
      
    if (allowed && requestOrigin) {
      response.headers.set('Access-Control-Allow-Origin', requestOrigin)
      if (credentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true')
      }
    }
    
    return response
  }
}
```

---

## 🟠 HIGH PRIORITY ISSUES (Fix This Sprint)

### 2. Information Leaks in Error Responses
**Location**: `packages/types/src/error-utils.ts`
**Issue**: Stack traces, IPs, and raw error details exposed
**Impact**: Internal architecture exposure, security through obscurity breach

**Fix**:
```typescript
// packages/types/src/error-utils.ts

// Add redaction utility
function redactSensitive(text: string): string {
  const patterns = [
    /(api[-_]?key|apikey|authorization|cookie|password|token|secret|jwt|bearer)([=:\s]+)([^\s,;}]+)/gi,
    /\/Users\/[^\/\s]+/g,  // File paths
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,  // IP addresses
  ]
  
  let redacted = text
  patterns.forEach(pattern => {
    redacted = redacted.replace(pattern, (match, p1, p2, p3) => {
      if (p1 && p2 && p3) return `${p1}${p2}[REDACTED]`
      return '[REDACTED]'
    })
  })
  return redacted
}

// Update error response creation
export function createErrorResponse(
  error: string | Error,
  status: number = 500,
  code?: string,
  traceId?: string,
  details?: unknown
): NextResponse {
  const errorMessage = typeof error === 'string' ? error : error.message
  const finalTraceId = traceId || generateTraceId()
  
  // NEVER include stack traces in responses
  const responseBody: ApiErrorResponse = {
    success: false,
    error: redactSensitive(errorMessage),
    code,
    timestamp: new Date().toISOString(),
    traceId: finalTraceId,
  }
  
  // Only include sanitized details in development
  if (process.env.NODE_ENV === 'development' && details) {
    responseBody.details = typeof details === 'object' 
      ? JSON.parse(redactSensitive(JSON.stringify(details)))
      : redactSensitive(String(details))
  }
  
  // Log full error server-side only
  if (typeof error !== 'string') {
    console.error('[API Error]', {
      message: redactSensitive(error.message),
      code,
      traceId: finalTraceId,
      // Stack stays server-side only
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
  
  return NextResponse.json(responseBody, { status })
}
```

### 3. Memory Leak in Rate Limiter
**Location**: `packages/security/src/rate-limiter.ts`
**Issue**: Cleanup runs but has edge cases
**Impact**: Memory growth in long-running processes

**Fix**:
```typescript
// packages/security/src/rate-limiter.ts

// More aggressive cleanup with WeakRef for auto-GC
class RateLimiterStore {
  private store = new Map<string, { count: number; resetTime: number }>()
  private cleanupTimer: NodeJS.Timer | null = null
  
  constructor(private windowMs: number) {
    // Clean up every minute or 1/10th of window, whichever is smaller
    const cleanupInterval = Math.min(60000, this.windowMs / 10)
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupInterval)
  }
  
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0
    for (const [key, record] of this.store.entries()) {
      if (record.resetTime <= now) {
        this.store.delete(key)
        cleaned++
      }
    }
    return cleaned
  }
  
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.store.clear()
  }
  
  // Rest of implementation...
}
```

---

## 🟡 MEDIUM PRIORITY ISSUES (Fix Next Sprint)

### 4. Type Drift and Inconsistencies
**Create single source of truth for all domain types**

**New File**: `packages/types/src/domain-constants.ts`
```typescript
// Single source of truth for all domain validations
export const HANDLE_REGEX = /^[a-zA-Z0-9_-]{3,30}$/
export const HANDLE_ERROR = 'Handle must be 3-30 characters, letters, numbers, underscore, or hyphen'

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const URL_REGEX = /^https?:\/\/.+$/

// Canonical schemas
import { z } from 'zod'

export const HandleSchema = z.string()
  .trim()
  .min(3)
  .max(30)
  .regex(HANDLE_REGEX, HANDLE_ERROR)

export const EmailSchema = z.string()
  .trim()
  .email()
  .toLowerCase()

export const DateTimeSchema = z.string()
  .datetime({ offset: true })
  .describe('ISO 8601 datetime with timezone')

// Canonical enums (single definition)
export const ActivityCode = z.enum(['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE'])
export type ActivityCode = z.infer<typeof ActivityCode>

export const SubmissionStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED'])
export type SubmissionStatus = z.infer<typeof SubmissionStatus>

export const Visibility = z.enum(['PUBLIC', 'PRIVATE'])
export type Visibility = z.infer<typeof Visibility>

export const UserRole = z.enum(['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN'])
export type UserRole = z.infer<typeof UserRole>

// Canonical pagination
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  })
```

**Migration Steps**:
1. Create `domain-constants.ts` with all canonical definitions
2. Find and replace all duplicate definitions to import from this file
3. Update all regex patterns to use the single source
4. Test all validators still work as expected

### 5. ORM/Model Leakage into API Surface
**Create DTO layer to prevent Prisma shapes from leaking**

**New File**: `packages/types/src/dto-mappers.ts`
```typescript
// Map Prisma models to clean DTOs

import type { Prisma } from '@prisma/client'

// Define clean public DTOs
export interface LeaderboardEntryDTO {
  rank: number
  user: {
    id: string
    handle: string
    name: string
    school?: string
    cohort?: string
  }
  totalPoints: number
  breakdown: {
    learn: number
    explore: number
    amplify: number
    present: number
    shine: number
  }
  lastActivity: string // ISO datetime
}

// Mappers from Prisma to DTO
export function mapLeaderboardEntry(
  prismaData: any, // Your actual Prisma type
  rank: number
): LeaderboardEntryDTO {
  return {
    rank,
    user: {
      id: prismaData.user_id,
      handle: prismaData.handle,
      name: prismaData.name,
      school: prismaData.school || undefined,
      cohort: prismaData.cohort || undefined,
    },
    totalPoints: prismaData.total_points || prismaData._sum?.points || 0,
    breakdown: {
      learn: prismaData.learn_points || 0,
      explore: prismaData.explore_points || 0,
      amplify: prismaData.amplify_points || 0,
      present: prismaData.present_points || 0,
      shine: prismaData.shine_points || 0,
    },
    lastActivity: prismaData.last_activity_at || prismaData.updated_at,
  }
}

// Similar mappers for other entities...
```

### 6. Package Dependency Cleanup
**Split types package to remove runtime dependencies**

**Action Plan**:
1. Move runtime code out of `@elevate/types`:
   ```bash
   # Move to new packages
   packages/http/        # NextResponse, middleware
   packages/validation/  # Zod schemas with runtime validation
   packages/test/        # Test utilities
   ```

2. Update `packages/types/package.json`:
   ```json
   {
     "name": "@elevate/types",
     "sideEffects": false,
     "dependencies": {
       "zod": "^3.22.0"  // Only Zod for type definitions
     },
     "devDependencies": {
       // Everything else
     }
   }
   ```

### 7. Over-permissive Payloads
**Replace z.record(z.unknown()) with specific schemas**

```typescript
// packages/types/src/submission-schemas.ts

// Instead of z.record(z.unknown())
const LearnPayloadSchema = z.object({
  certificateUrl: z.string().url(),
  certificateHash: z.string(),
  completedAt: DateTimeSchema,
})

const ExplorePayloadSchema = z.object({
  reflection: z.string().min(100).max(5000),
  evidenceUrls: z.array(z.string().url()).max(5),
  implementedAt: DateTimeSchema,
})

// ... similar for other activities

export const SubmissionPayloadSchema = z.discriminatedUnion('activityCode', [
  z.object({ activityCode: z.literal('LEARN'), data: LearnPayloadSchema }),
  z.object({ activityCode: z.literal('EXPLORE'), data: ExplorePayloadSchema }),
  // ... etc
])

// For truly dynamic data, limit scope
const KajabiWebhookSchema = z.object({
  event_type: z.string(),
  occurred_at: DateTimeSchema,
  // Only include fields we actually use
  contact: z.object({
    id: z.string(),
    email: EmailSchema,
    name: z.string().optional(),
  }),
  // Store raw payload separately if needed
  _raw: z.string().optional(), // JSON string for archival
})
```

---

## 🟢 LOW PRIORITY (Tech Debt Cleanup)

### 8. Canonical URL Utilities
```typescript
// packages/types/src/canonical-urls.ts

const getSiteUrl = () => {
  const url = process.env.NEXT_PUBLIC_SITE_URL
  if (!url && process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_SITE_URL is required in production')
  }
  return new URL(url || 'http://localhost:3000')
}

export function getProfileUrl(handle: string): string {
  if (!HandleSchema.safeParse(handle).success) {
    throw new Error(`Invalid handle: ${handle}`)
  }
  const base = getSiteUrl()
  return new URL(`/u/${encodeURIComponent(handle)}`, base).toString()
}
```

---

## Implementation Strategy

### Phase 1: Critical Security (Week 1)
- [ ] Fix CORS wildcard vulnerability
- [ ] Add error redaction
- [ ] Add Vary: Origin header

### Phase 2: Type Consolidation (Week 2)
- [ ] Create domain-constants.ts
- [ ] Migrate all handle validations
- [ ] Unify enum definitions
- [ ] Standardize date handling

### Phase 3: Clean Architecture (Week 3-4)
- [ ] Create DTO mappers
- [ ] Remove ORM shapes from APIs
- [ ] Split packages properly
- [ ] Tighten payload schemas

### Testing Requirements
- Unit tests for all security fixes
- Integration tests for CORS behavior
- Regression tests for type changes
- Performance tests for rate limiter

### Rollback Plan
- Each phase deployed separately
- Feature flags for major changes
- Database migrations are backward compatible
- API versioning if needed

---

## Success Metrics
- Zero security vulnerabilities in production
- 100% type coverage (no `any` types)
- Consistent validation across all inputs
- No ORM shapes in public APIs
- Clean package dependencies

---

## Team Assignments
- **Security Lead**: CORS, error handling, rate limiting
- **Type System Lead**: Domain constants, DTO mappers
- **Architecture Lead**: Package splitting, dependency cleanup
- **QA Lead**: Testing strategy, regression prevention

---

## Timeline
- Week 1: Critical security fixes
- Week 2: Type consolidation
- Week 3-4: Architecture cleanup
- Week 5: Testing and deployment

This plan focuses exclusively on fixing existing issues without introducing new features, ensuring backward compatibility while improving security and type safety.