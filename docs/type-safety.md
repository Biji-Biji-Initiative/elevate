# Type Safety Guide

This document outlines the type safety standards and practices for the MS Elevate LEAPS Tracker project.

## 🎯 Goals

- **Zero `as any` casts**: Eliminate all unsafe type casting in the codebase
- **Runtime validation**: Validate external data using Zod schemas
- **Type-safe database operations**: Use proper types for Prisma operations
- **Comprehensive testing**: Ensure type safety through automated tests

## 🚫 Prohibited Patterns

### ❌ Avoid These

```typescript
// DON'T: as any casts
const data = response.data as any
user.role = metadata.role as any

// DON'T: as unknown as casts (unless absolutely necessary)
const config = settings as unknown as Config

// DON'T: any type annotations
function processData(data: any): any {
  return data.whatever
}

// DON'T: @ts-ignore without explanation
// @ts-ignore
const result = problematicFunction()
```

## ✅ Recommended Patterns

### Type-Safe Data Parsing

```typescript
// DO: Use Zod parsers for external data
import { parseActivityCode, parseSubmissionStatus } from '@elevate/types'

const activityCode = parseActivityCode(req.body.activity)
if (!activityCode) {
  return NextResponse.json({ error: 'Invalid activity code' }, { status: 400 })
}

// DO: Use type guards for union types
function isValidRole(role: string): role is Role {
  return ['participant', 'reviewer', 'admin', 'superadmin'].includes(role)
}
```

### Prisma JSON Operations

```typescript
// DO: Use toPrismaJson helper for JSON fields
import { toPrismaJson } from '@elevate/types'

await prisma.submission.create({
  data: {
    payload: toPrismaJson(validatedPayload),
    meta: toPrismaJson({ source: 'manual', timestamp: Date.now() })
  }
})

// DO: Parse JSON responses safely
const payload = parseSubmissionPayload(submission.payload)
if (!payload) {
  throw new Error('Invalid submission payload')
}
```

### Auth Metadata Handling

```typescript
// DO: Use safe Clerk metadata parsers
import { parseClerkPublicMetadata, normalizeRole } from '@elevate/types'

const metadata = parseClerkPublicMetadata(user.publicMetadata)
const role = normalizeRole(metadata.role)

// DO: Type audit log metadata
import { toPrismaJson, type SubmissionAuditMeta } from '@elevate/types'

const auditMeta: SubmissionAuditMeta = {
  submissionId: submission.id,
  pointsAwarded: points,
  reviewNote: 'Great work!'
}

await prisma.auditLog.create({
  data: {
    actor_id: user.id,
    action: 'APPROVE_SUBMISSION',
    meta: toPrismaJson(auditMeta)
  }
})
```

## 📋 Available Parsers and Types

### Core Data Types

| Parser | Input Type | Return Type | Use Case |
|--------|------------|-------------|----------|
| `parseActivityCode()` | `unknown` | `ActivityCode \| null` | Validating activity codes |
| `parseSubmissionStatus()` | `unknown` | `SubmissionStatus \| null` | Validating submission statuses |
| `parseRole()` | `unknown` | `Role \| null` | Validating user roles |
| `parseVisibility()` | `unknown` | `Visibility \| null` | Validating visibility settings |

### Submission Payloads

| Parser | Input Type | Return Type | Use Case |
|--------|------------|-------------|----------|
| `parseSubmissionPayload()` | `unknown` | `SubmissionPayload \| null` | Any submission type |
| `parseLearnPayload()` | `unknown` | `LearnPayload \| null` | LEARN submissions |
| `parseExplorePayload()` | `unknown` | `ExplorePayload \| null` | EXPLORE submissions |
| `parseAmplifyPayload()` | `unknown` | `AmplifyPayload \| null` | AMPLIFY submissions |
| `parsePresentPayload()` | `unknown` | `PresentPayload \| null` | PRESENT submissions |
| `parseShinePayload()` | `unknown` | `ShinePayload \| null` | SHINE submissions |

### Audit Metadata

| Parser | Input Type | Return Type | Use Case |
|--------|------------|-------------|----------|
| `parseSubmissionAuditMeta()` | `unknown` | `SubmissionAuditMeta \| null` | Submission audit logs |
| `parseUserAuditMeta()` | `unknown` | `UserAuditMeta \| null` | User modification logs |
| `parseBadgeAuditMeta()` | `unknown` | `BadgeAuditMeta \| null` | Badge management logs |
| `parseExportAuditMeta()` | `unknown` | `ExportAuditMeta \| null` | Data export logs |
| `parseKajabiAuditMeta()` | `unknown` | `KajabiAuditMeta \| null` | Kajabi webhook logs |

### Auth and External Services

| Parser | Input Type | Return Type | Use Case |
|--------|------------|-------------|----------|
| `parseClerkPublicMetadata()` | `unknown` | `{ role?: string }` | Clerk user metadata |
| `parseClerkEmailAddress()` | `unknown` | `string \| undefined` | Clerk email objects |
| `normalizeRole()` | `string \| undefined` | `Role` | Role normalization |

## 🧪 Testing

Run type safety tests to ensure all parsers work correctly:

```bash
# Run type safety tests
pnpm -F @elevate/types test

# Check for unsafe patterns in codebase
pnpm type-safety:check

# Strict mode (warnings become errors)
pnpm type-safety:strict

# Show best practices guide
pnpm type-safety:help
```

## 🔧 Common Patterns

### API Route Handler

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers'
import { parseActivityCode, toPrismaJson, type ActivityCode } from '@elevate/types'
import { prisma } from '@elevate/db/client'

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body = await request.json()
    
    // Parse and validate input
    const activityCode = parseActivityCode(body.activityCode)
    if (!activityCode) {
      return NextResponse.json(
        { error: 'Invalid activity code' },
        { status: 400 }
      )
    }
    
    // Type-safe database operation
    const result = await prisma.submission.create({
      data: {
        user_id: user.userId,
        activity_code: activityCode,
        payload: toPrismaJson(body.payload),
        meta: toPrismaJson({
          created_by: user.userId,
          timestamp: new Date().toISOString()
        })
      }
    })
    
    return NextResponse.json({ success: true, id: result.id })
  } catch (error) {
    return createErrorResponse(error)
  }
}
```

### React Component with Payload

```typescript
import { parseExplorePayload } from '@elevate/types'

interface SubmissionCardProps {
  submission: {
    id: string
    activity_code: string
    payload: unknown
  }
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
  // Type-safe payload parsing
  if (submission.activity_code === 'EXPLORE') {
    const exploreData = parseExplorePayload(submission.payload)
    if (!exploreData) {
      return <div>Invalid submission data</div>
    }
    
    return (
      <div>
        <h3>Explore Submission</h3>
        <p>Class Date: {exploreData.data.classDate}</p>
        <p>Reflection: {exploreData.data.reflection}</p>
      </div>
    )
  }
  
  return <div>Unknown submission type</div>
}
```

### Error Handling with Types

```typescript
import { extractAxiosErrorMessage } from '@elevate/integrations'

async function apiCall() {
  try {
    const response = await fetch('/api/data')
    const data = await response.json()
    
    // Validate response structure
    const parsed = parseApiResponse(data)
    if (!parsed) {
      throw new Error('Invalid API response format')
    }
    
    return parsed
  } catch (error) {
    // Type-safe error handling
    const message = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred'
    
    throw new Error(`API call failed: ${message}`)
  }
}
```

## 🛠️ Adding New Types

When adding new data types or parsers:

1. **Define the Zod schema**:
```typescript
export const NewDataSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  optional: z.string().optional()
})

export type NewData = z.infer<typeof NewDataSchema>
```

2. **Create a parser function**:
```typescript
export function parseNewData(value: unknown): NewData | null {
  const result = NewDataSchema.safeParse(value)
  return result.success ? result.data : null
}
```

3. **Add tests**:
```typescript
describe('NewData parsing', () => {
  it('should parse valid data', () => {
    const valid = { id: '123', name: 'test' }
    expect(parseNewData(valid)).toEqual(valid)
  })
  
  it('should return null for invalid data', () => {
    expect(parseNewData({})).toBeNull()
    expect(parseNewData(null)).toBeNull()
  })
})
```

4. **Export from index**:
```typescript
export { parseNewData, NewDataSchema, type NewData } from './new-data'
```

## 🚀 CI/CD Integration

Type safety is enforced through:

- **Pre-commit hooks**: Run `type-safety:check` before commits
- **GitHub Actions**: Automatic validation on PRs and pushes
- **Strict mode**: Warnings treated as errors in CI
- **Detailed reports**: JSON reports uploaded as artifacts

### GitHub Actions Workflow

The type safety workflow runs on every push and PR, generating detailed reports and PR comments when issues are found.

## 📚 Best Practices Summary

1. **Never use `as any`** - Always use proper parsing functions
2. **Validate external data** - Use Zod schemas for all external inputs
3. **Type database operations** - Use `toPrismaJson()` for JSON fields
4. **Handle errors gracefully** - Provide meaningful error messages
5. **Test your types** - Write tests for all parsing functions
6. **Document new patterns** - Update this guide when adding new types

## 🆘 Troubleshooting

### Common Issues

**Q: I'm getting a TypeScript error with Prisma JSON fields**
```typescript
// ❌ Don't do this
data: { meta: someObject as any }

// ✅ Do this instead
data: { meta: toPrismaJson(someObject) }
```

**Q: How do I handle union types safely?**
```typescript
// ✅ Use type guards
if (data.type === 'submission') {
  const submission = parseSubmissionPayload(data.payload)
  // Handle submission...
}
```

**Q: External API returns unknown data structure**
```typescript
// ✅ Create a schema and parser
const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown()
})

const response = parseApiResponse(await api.getData())
if (!response?.success) {
  throw new Error('API request failed')
}
```

For more help, check the test files in `packages/types/__tests__/` for comprehensive examples.