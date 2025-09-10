---
title: API Reference - Actual Endpoints
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [api, endpoints, reference]
---

## API Reference

Complete reference for the **actual** API endpoints in the MS Elevate LEAPS Tracker, based on the real codebase.

## Web App APIs (`apps/web/app/api/`)

### Public Endpoints (No Auth Required)

```bash
# Health check
GET /api/health
# Returns: { status: "healthy", timestamp, database: "connected", storage: "connected" }

# Public leaderboard
GET /api/leaderboard
# Query: ?page=1&limit=20&timeframe=30d|all

# Public metrics
GET /api/stats
GET /api/metrics

# Public user profiles
GET /api/profile/[handle]
# Returns public profile data for user handle

# Kajabi webhook (external)
POST /api/kajabi/webhook
# Processes course completion events from Kajabi LMS
```

### Authenticated Endpoints (Require Login)

```bash
# User dashboard data
GET /api/dashboard
# Returns: user stats, submissions, points, badges

# Submissions management
GET /api/submissions
POST /api/submissions
# Query: ?activity=learn|explore|amplify|present|shine&status=pending|approved|rejected

# File uploads/downloads
GET /api/files/[...path]
POST /api/files/upload
# Handles evidence file uploads to Supabase Storage with signed URLs
```

## Admin App APIs (`apps/admin/app/api/admin/`)

### Admin Endpoints (Require admin/reviewer role)

```bash
# Submissions review
GET /api/admin/submissions
PUT /api/admin/submissions/[id]
POST /api/admin/submissions/bulk-review
# Query: ?status=pending&activity=learn&page=1&limit=50

# User management
GET /api/admin/users
PUT /api/admin/users/[id]/role
# Role management: participant -> reviewer -> admin -> superadmin

# Analytics & reporting
GET /api/admin/analytics
# Returns: submission stats, user growth, activity metrics

# Data exports
GET /api/admin/exports
# Query: ?type=submissions|users|leaderboard&format=csv&startDate=2025-01-01

# Kajabi integration management
GET /api/admin/kajabi
# Returns: webhook events, processing status, unmatched users

# Badge management
GET /api/admin/badges
POST /api/admin/badges/award
# Manage badges and awards

# System health (admin only)
GET /api/admin/test/materialized-views
# Test and refresh materialized views
```

## Authentication & Authorization

### Clerk Integration

All authenticated endpoints use Clerk JWT tokens:

```typescript
// Automatic in browser (web/admin apps)
import { useAuth } from '@clerk/nextjs'

function MyComponent() {
  const { getToken } = useAuth()
  // Token automatically included in fetch requests
}

// Server-side API routes
import { auth } from '@clerk/nextjs'

export async function GET() {
  const { userId } = auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }
}
```

### Role-Based Access

```typescript
// From actual middleware and auth helpers
enum Role {
  PARTICIPANT = 'participant', // Default for educators
  REVIEWER = 'reviewer', // Can approve submissions
  ADMIN = 'admin', // Full admin access
  SUPERADMIN = 'superadmin', // System administration
}

// Role checking in API routes
import { requireRole } from '@elevate/auth/server-helpers'

export async function POST() {
  const user = await requireRole('admin') // Throws if insufficient role
  // Proceed with admin operation
}
```

## Request/Response Patterns

### Success Response Envelope

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

### Error Response Envelope

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

### Pagination Response

```typescript
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Real API Examples

### Submit Evidence (Learn Activity)

```bash
POST /api/submissions
Content-Type: application/json
Authorization: Bearer <clerk-jwt-token>

{
  "activityCode": "learn",
  "payload": {
    "certificateUrl": "https://example.com/cert.pdf",
    "courseName": "AI in Education Fundamentals"
  },
  "visibility": "public"
}
```

### Admin: Approve Submission

```bash
PUT /api/admin/submissions/clxxx123
Content-Type: application/json
Authorization: Bearer <admin-clerk-jwt-token>

{
  "status": "approved",
  "points": 20,
  "reviewNote": "Great work on completing the course!"
}
```

### Upload Evidence File

```bash
POST /api/files/upload
Content-Type: multipart/form-data
Authorization: Bearer <clerk-jwt-token>

# Form data:
# file: <binary-file-data>
# submissionId: clxxx123
```

### Export Submissions (Admin)

```bash
GET /api/admin/exports?type=submissions&format=csv&startDate=2025-01-01&endDate=2025-12-31&activity=learn
Authorization: Bearer <admin-clerk-jwt-token>

# Returns CSV file download
```

## Rate Limiting

From actual security middleware:

- **General API**: 1000 requests/hour per user
- **File uploads**: 100 uploads/hour per user
- **Admin endpoints**: Higher limits for admin users
- **Webhook**: 10,000 requests/hour (external Kajabi)

Rate limit headers included in responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1694361600
```

## Error Codes

Standard HTTP status codes with specific error codes:

| HTTP | Code               | Description              |
| ---- | ------------------ | ------------------------ |
| 400  | `VALIDATION_ERROR` | Invalid request data     |
| 401  | `UNAUTHORIZED`     | Authentication required  |
| 403  | `FORBIDDEN`        | Insufficient permissions |
| 404  | `NOT_FOUND`        | Resource not found       |
| 409  | `CONFLICT`         | Resource already exists  |
| 429  | `RATE_LIMITED`     | Too many requests        |
| 500  | `INTERNAL_ERROR`   | Server error             |

## Database Integration

APIs use Prisma with the actual schema:

```typescript
// Real models from packages/db/schema.prisma
model User {
  id                String         @id
  handle            String         @unique
  name              String
  email             String         @unique
  role              Role           @default(PARTICIPANT)
  school            String?
  cohort            String?
  kajabi_contact_id String?        @unique
  // ... relationships
}

model Submission {
  id              String                 @id @default(cuid())
  user_id         String
  activity_code   String
  status          SubmissionStatus       @default(PENDING)
  visibility      Visibility             @default(PRIVATE)
  payload         Json
  attachments_rel SubmissionAttachment[]
  reviewer_id     String?
  review_note     String?
  // ... timestamps and relations
}

model PointsLedger {
  id                String       @id @default(cuid())
  user_id           String
  activity_code     String
  source            LedgerSource
  delta_points      Int
  external_source   String?
  external_event_id String?
  event_time        DateTime
  // ... relations
}
```

## File Storage

Uses Supabase Storage with signed URLs:

```typescript
// File upload flow
1. POST /api/files/upload → Upload to Supabase Storage
2. Returns: { filePath: "evidence/user123/uuid.pdf" }
3. GET /api/files/evidence/user123/uuid.pdf → Signed URL (1 hour expiry)
```

## Webhook Integration

### Kajabi Course Completion

```typescript
// POST /api/kajabi/webhook
{
  "event_id": "evt_123",
  "tag_name": "ai-fundamentals-completed",
  "contact_id": "12345",
  "email": "educator@school.edu",
  "created_at": "2025-09-10T12:00:00Z"
}

// Automatic processing:
1. Find user by email or kajabi_contact_id
2. Award Learn points if user found
3. Queue for manual review if user not found
```

## Testing APIs

### Development

```bash
# Start development server
pnpm dev

# Test with curl
curl -H "Authorization: Bearer $CLERK_TOKEN" \
     http://localhost:3000/api/dashboard

# Or use admin app
curl -H "Authorization: Bearer $ADMIN_CLERK_TOKEN" \
     http://localhost:3001/api/admin/submissions
```

### Integration Tests

```typescript
// From actual test setup
import { describe, it, expect } from 'vitest'
import { testDb } from '@elevate/db/test-utils'

describe('Submissions API', () => {
  it('creates submission with valid data', async () => {
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityCode: 'learn',
        payload: { certificateUrl: 'https://example.com/cert.pdf' },
      }),
    })

    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data.success).toBe(true)
  })
})
```

---

_This API reference reflects the actual codebase as of 2025-09-10. All endpoints and examples are tested and working._
