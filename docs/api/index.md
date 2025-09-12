---
title: API Usage Guide
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [api, client, openapi, envelopes]
---

## API Usage Guide

Complete guide for using the MS Elevate LEAPS Tracker APIs, including client libraries, response envelopes, and OpenAPI specifications.

## Overview

The platform provides REST APIs for both internal use (between web/admin apps and backend) and potential external integrations. All APIs follow consistent patterns for authentication, validation, and response formatting.

### API Endpoints

- **Web App API**: `https://leaps.mereka.org/api/*` (32 routes)
- **Admin App API**: `https://admin.leaps.mereka.org/api/*` (19 routes)
- **OpenAPI Spec**: Available at `/api/openapi.json` on each app

#### Web App Routes (32 total)

Core endpoints include: `/api/health`, `/api/dashboard`, `/api/submissions`, `/api/leaderboard`, `/api/profile/*`, `/api/badges`, `/api/metrics`, `/api/files/*`, `/api/webhooks/clerk`, `/api/kajabi/webhook`, `/api/emails/*`, `/api/cron/*`, and admin performance routes.

#### Admin App Routes (19 total)

Admin-specific endpoints include: `/api/admin/submissions`, `/api/admin/users`, `/api/admin/badges/*`, `/api/admin/analytics`, `/api/admin/exports`, `/api/admin/kajabi/*`, `/api/admin/meta/*`, and storage management routes.

## Response Envelopes

All API responses use consistent envelope patterns from `@elevate/http`:

### Success Response

```typescript
{
  "success": true,
  "data": {
    // Actual response data
  },
  "meta": {
    "timestamp": "2025-09-10T12:00:00Z",
    "requestId": "req_123456"
  }
}
```

### Error Response

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  },
  "meta": {
    "timestamp": "2025-09-10T12:00:00Z",
    "requestId": "req_123456"
  }
}
```

### Paginated Response

```typescript
{
  "success": true,
  "data": [
    // Array of items
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "timestamp": "2025-09-10T12:00:00Z",
    "requestId": "req_123456"
  }
}
```

## Using Response Envelopes

### In Route Handlers

```typescript
import { createSuccessResponse, createErrorResponse } from '@elevate/http'

export async function GET() {
  try {
    const users = await getUsers()
    return createSuccessResponse(users)
  } catch (error) {
    return createErrorResponse('FETCH_FAILED', 'Failed to fetch users', error)
  }
}
```

### Available Envelope Helpers

```typescript
// Success responses
createSuccessResponse(data, meta?)
createPaginatedResponse(data, pagination, meta?)

// Error responses
createErrorResponse(code, message, details?)
createValidationErrorResponse(errors)
createNotFoundResponse(resource?)
createUnauthorizedResponse(message?)
createForbiddenResponse(message?)

// Utility
isSuccessResponse(response)
isErrorResponse(response)
extractData(response)
extractError(response)
```

## API Client

The `@elevate/api-client` package provides type-safe clients for both apps:

### Installation

```typescript
import { createWebClient, createAdminClient } from '@elevate/api-client'

// Web app client
const webClient = createWebClient({
  baseUrl: 'https://leaps.mereka.org/api',
  // Auth token automatically handled by Clerk
})

// Admin app client
const adminClient = createAdminClient({
  baseUrl: 'https://admin.leaps.mereka.org/api',
  // Auth token automatically handled by Clerk
})
```

### Usage Examples

```typescript
// Fetch user profile
const userResponse = await webClient.users.getProfile()
if (userResponse.success) {
  console.log(userResponse.data.name)
} else {
  console.error(userResponse.error.message)
}

// Submit evidence
const submissionResponse = await webClient.submissions.create({
  activityCode: 'learn',
  payload: { certificateUrl: 'https://...' },
  visibility: 'public',
})

// Admin: Approve submission
const approvalResponse = await adminClient.submissions.approve(submissionId, {
  points: 20,
  reviewNote: 'Great work!',
})

// Paginated requests
const leaderboardResponse = await webClient.leaderboard.get({
  page: 1,
  limit: 20,
  timeframe: '30d',
})
```

### Error Handling

```typescript
import { isErrorResponse, extractError } from '@elevate/api-client'

const response = await webClient.users.getProfile()

if (isErrorResponse(response)) {
  const error = extractError(response)

  switch (error.code) {
    case 'UNAUTHORIZED':
      // Redirect to login
      break
    case 'VALIDATION_ERROR':
      // Show form errors
      break
    default:
      // Show generic error
      break
  }
} else {
  // Handle success
  const user = response.data
}
```

## OpenAPI Specification

### Accessing the Spec

- **Web App**: `GET /api/openapi.json`
- **Admin App**: `GET /api/openapi.json`
- **Local Development**: `http://localhost:3000/api/openapi.json`

### Code Generation

Generate client code from OpenAPI spec:

```bash
# Install OpenAPI generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i https://leaps.mereka.org/api/openapi.json \
  -g typescript-fetch \
  -o ./generated-client
```

### Spec Structure

The OpenAPI spec includes:

- **Authentication**: Clerk JWT token requirements
- **Endpoints**: All available API routes
- **Schemas**: Request/response type definitions
- **Examples**: Sample requests and responses
- **Error Codes**: Standardized error responses

## Authentication

### Clerk Integration

APIs use Clerk for authentication. Tokens are automatically handled in browser environments:

```typescript
// In React components (web/admin apps)
import { useAuth } from '@clerk/nextjs'

function MyComponent() {
  const { getToken } = useAuth()

  // Token automatically included in API client requests
  const response = await webClient.users.getProfile()
}
```

### Server-Side Authentication

```typescript
// In API routes
import { auth } from '@clerk/nextjs'

export async function GET() {
  const { userId } = auth()

  if (!userId) {
    return createUnauthorizedResponse()
  }

  // Proceed with authenticated request
}
```

### Role-Based Access

```typescript
import { requireRole } from '@elevate/auth'

export async function POST() {
  // Require admin role
  const user = await requireRole('admin')

  // Proceed with admin-only operation
}
```

## Common API Patterns

### Validation

All endpoints use Zod schemas for validation:

```typescript
import { z } from 'zod'
import { validateRequest } from '@elevate/http'

const CreateSubmissionSchema = z.object({
  activityCode: z.enum(['learn', 'explore', 'amplify', 'present', 'shine']),
  payload: z.record(z.any()),
  visibility: z.enum(['public', 'private']).default('private'),
})

export async function POST(request: Request) {
  const validation = await validateRequest(request, CreateSubmissionSchema)

  if (!validation.success) {
    return createValidationErrorResponse(validation.errors)
  }

  const { activityCode, payload, visibility } = validation.data
  // Proceed with validated data
}
```

### File Uploads

File uploads use Supabase Storage with signed URLs:

```typescript
// Upload endpoint
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  // Validate file type and size
  if (!isValidFileType(file.type)) {
    return createErrorResponse(
      'INVALID_FILE_TYPE',
      'Only images and PDFs allowed',
    )
  }

  // Upload to Supabase Storage
  const filePath = await uploadFile(file, 'evidence')

  return createSuccessResponse({ filePath })
}

// Download endpoint (signed URL)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')

  // Generate signed URL
  const signedUrl = await getSignedUrl(filePath, 3600) // 1 hour expiry

  return createSuccessResponse({ url: signedUrl })
}
```

### Pagination

Consistent pagination across all list endpoints:

```typescript
import { createPaginatedResponse } from '@elevate/http'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const { items, total } = await getSubmissions({
    page,
    limit,
    userId: auth().userId,
  })

  return createPaginatedResponse(items, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  })
}
```

## Error Handling

### Standard Error Codes

| Code               | HTTP Status | Description              |
| ------------------ | ----------- | ------------------------ |
| `VALIDATION_ERROR` | 400         | Invalid request data     |
| `UNAUTHORIZED`     | 401         | Authentication required  |
| `FORBIDDEN`        | 403         | Insufficient permissions |
| `NOT_FOUND`        | 404         | Resource not found       |
| `CONFLICT`         | 409         | Resource already exists  |
| `RATE_LIMITED`     | 429         | Too many requests        |
| `INTERNAL_ERROR`   | 500         | Server error             |

### Error Response Format

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "email",
      "issue": "Invalid email format",
      "received": "invalid-email"
    }
  },
  "meta": {
    "timestamp": "2025-09-10T12:00:00Z",
    "requestId": "req_123456"
  }
}
```

## Rate Limiting

APIs implement rate limiting to prevent abuse:

### Limits

- **Authenticated Users**: 1000 requests/hour
- **File Uploads**: 100 uploads/hour
- **Webhook Endpoints**: 10,000 requests/hour

### Headers

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1694361600
```

### Handling Rate Limits

```typescript
const response = await webClient.users.getProfile()

if (response.error?.code === 'RATE_LIMITED') {
  const resetTime = response.meta?.rateLimitReset
  // Wait until reset time or show user message
}
```

## Testing APIs

### Development Testing

```bash
# Start development server
pnpm dev

# Test endpoints with curl
curl -H "Authorization: Bearer $CLERK_TOKEN" \
     http://localhost:3000/api/users/profile

# Or use the API client in tests
import { createWebClient } from '@elevate/api-client'

const client = createWebClient({
  baseUrl: 'http://localhost:3000/api'
})
```

### Integration Tests

```typescript
import { describe, it, expect } from 'vitest'
import { createTestClient } from '@elevate/api-client/test'

describe('Users API', () => {
  it('returns user profile', async () => {
    const client = createTestClient()
    const response = await client.users.getProfile()

    expect(response.success).toBe(true)
    expect(response.data.email).toBeDefined()
  })
})
```

## Migration Guide

### From Direct Fetch to API Client

**Before:**

```typescript
const response = await fetch('/api/users/profile', {
  headers: { Authorization: `Bearer ${token}` },
})
const data = await response.json()
```

**After:**

```typescript
const response = await webClient.users.getProfile()
if (response.success) {
  const data = response.data
}
```

### Adding New Endpoints

1. **Create API Route**: Add route handler in `app/api/`
2. **Add to Client**: Update `@elevate/api-client` with new method
3. **Update OpenAPI**: Regenerate spec with new endpoint
4. **Add Tests**: Write integration tests for new endpoint

---

_This guide covers the core API patterns. For specific endpoint documentation, see the OpenAPI specification at `/api/openapi.json`._
