---
title: Security & Privacy Guide
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [security, privacy, rbac, pii, rls]
---

## Security & Privacy Guide

Comprehensive security and privacy implementation for the MS Elevate LEAPS Tracker platform.

## Overview

The platform handles sensitive educator data and requires robust security measures to protect user privacy while enabling program functionality. This guide covers authentication, authorization, data protection, and privacy policies.

## Authentication

### Clerk Integration

The platform uses Clerk for authentication with Google OAuth as the only provider:

```typescript
// Authentication check in API routes
import { auth } from '@clerk/nextjs'

export async function GET() {
  const { userId } = auth()

  if (!userId) {
    return createUnauthorizedResponse()
  }

  // Proceed with authenticated request
}
```

### Session Management

- **Token Handling**: Clerk manages JWT tokens automatically
- **Session Duration**: Configurable in Clerk dashboard (default: 7 days)
- **Refresh**: Automatic token refresh handled by Clerk
- **Logout**: Clerk handles secure logout and token invalidation

### Security Headers

```typescript
// Next.js middleware for security headers
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  )

  return response
}
```

## Role-Based Access Control (RBAC)

### Role Hierarchy

```typescript
enum UserRole {
  PARTICIPANT = 'participant', // Default role for educators
  REVIEWER = 'reviewer', // Can approve submissions
  ADMIN = 'admin', // Full admin access
  SUPERADMIN = 'superadmin', // System administration
}
```

### Role Permissions

| Action              | Participant | Reviewer | Admin | Superadmin |
| ------------------- | ----------- | -------- | ----- | ---------- |
| Submit evidence     | ✅          | ✅       | ✅    | ✅         |
| View own data       | ✅          | ✅       | ✅    | ✅         |
| Approve submissions | ❌          | ✅       | ✅    | ✅         |
| Manage users        | ❌          | ❌       | ✅    | ✅         |
| Export data         | ❌          | ❌       | ✅    | ✅         |
| System config       | ❌          | ❌       | ❌    | ✅         |

### Role Enforcement

```typescript
// Server-side role checking
import { requireRole } from '@elevate/auth'

export async function POST() {
  // Require admin role or higher
  const user = await requireRole('admin')

  // Proceed with admin-only operation
}

// Component-level role checking
import { useRole } from '@elevate/auth'

function AdminPanel() {
  const { hasRole } = useRole()

  if (!hasRole('admin')) {
    return <AccessDenied />
  }

  return <AdminInterface />
}
```

### Role Assignment

Roles are assigned through:

1. **Default**: All new users get `participant` role
2. **Manual**: Admins can promote users via admin console
3. **Automated**: Future integration with Microsoft systems

```typescript
// Role assignment in admin console
async function promoteUser(userId: string, newRole: UserRole) {
  const currentUser = await requireRole('admin')

  // Prevent self-demotion and unauthorized promotion
  if (userId === currentUser.id && newRole < currentUser.role) {
    throw new Error('Cannot demote yourself')
  }

  if (newRole === 'superadmin' && currentUser.role !== 'superadmin') {
    throw new Error('Only superadmins can create superadmins')
  }

  await updateUserRole(userId, newRole)
  await logAuditEvent('role_change', { userId, newRole, actor: currentUser.id })
}
```

## Data Protection

### Personally Identifiable Information (PII)

#### PII Classification

**High Sensitivity:**

- Email addresses
- Full names
- School affiliations
- Phone numbers (if collected)

**Medium Sensitivity:**

- User handles/usernames
- Submission content
- Evidence files

**Low Sensitivity:**

- Points and badges
- Public activity counts
- Anonymized metrics

#### PII Handling Rules

```typescript
// PII access control
interface UserData {
  id: string
  email: string // PII - restricted access
  name: string // PII - restricted access
  handle: string // Public if user opts in
  school: string // PII - restricted access
  points: number // Public
  badges: Badge[] // Public
}

// Safe user data for public contexts
function sanitizeUserForPublic(user: UserData, includePrivate = false) {
  const publicData = {
    id: user.id,
    handle: user.handle,
    points: user.points,
    badges: user.badges,
  }

  if (includePrivate && user.profileVisibility === 'public') {
    return {
      ...publicData,
      name: user.name,
      school: user.school,
    }
  }

  return publicData
}
```

### Data Visibility Controls

#### Profile Visibility

Users control their profile visibility:

```typescript
enum ProfileVisibility {
  PRIVATE = 'private', // Only visible to user and admins
  PUBLIC = 'public', // Visible on leaderboards and public profiles
}

// Default visibility settings
const DEFAULT_VISIBILITY = {
  profile: 'private',
  submissions: 'private',
  leaderboard: 'public', // Points only, no PII
}
```

#### Submission Visibility

Each submission has independent visibility:

```typescript
interface Submission {
  id: string
  userId: string
  visibility: 'public' | 'private'
  status: 'pending' | 'approved' | 'rejected'
  // ... other fields
}

// Public submissions query
async function getPublicSubmissions(userId: string) {
  return await db.submission.findMany({
    where: {
      userId,
      visibility: 'public',
      status: 'approved',
    },
    select: {
      id: true,
      activityCode: true,
      payload: true,
      createdAt: true,
      // Exclude internal fields
    },
  })
}
```

### Row Level Security (RLS)

#### Database Policies

Supabase RLS policies enforce data access at the database level:

```sql
-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id);

-- Submissions visibility policy
CREATE POLICY "Submission visibility" ON submissions
  FOR SELECT USING (
    -- Own submissions
    auth.uid()::text = user_id OR
    -- Public approved submissions
    (visibility = 'public' AND status = 'approved') OR
    -- Admins can see all
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
      AND role IN ('admin', 'superadmin')
    )
  );

-- Points ledger - users see own, admins see all
CREATE POLICY "Points ledger access" ON points_ledger
  FOR SELECT USING (
    auth.uid()::text = user_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
      AND role IN ('admin', 'superadmin')
    )
  );
```

#### API-Level Enforcement

```typescript
// Additional API-level checks
async function getSubmissions(userId: string, requesterId: string) {
  const requester = await getUser(requesterId)

  // Users can only see their own submissions unless admin
  if (userId !== requesterId && !hasRole(requester, 'admin')) {
    throw new ForbiddenError('Cannot access other user submissions')
  }

  return await db.submission.findMany({
    where: { userId },
  })
}
```

## File Security

### Evidence File Storage

Files are stored in Supabase Storage with strict access controls:

```typescript
// File upload with security checks
async function uploadEvidence(file: File, userId: string) {
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError('Invalid file type')
  }

  // Validate file size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    throw new ValidationError('File too large')
  }

  // Generate secure file path
  const fileId = crypto.randomUUID()
  const filePath = `evidence/${userId}/${fileId}`

  // Upload to private bucket
  const { data, error } = await supabase.storage
    .from('evidence')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) throw error

  return filePath
}
```

### Signed URLs

Access to files requires signed URLs with expiration:

```typescript
// Generate signed URL for file access
async function getFileUrl(
  filePath: string,
  userId: string,
  requesterId: string,
) {
  // Check access permissions
  const canAccess = await canAccessFile(filePath, userId, requesterId)
  if (!canAccess) {
    throw new ForbiddenError('Cannot access file')
  }

  // Generate signed URL (1 hour expiry)
  const { data, error } = await supabase.storage
    .from('evidence')
    .createSignedUrl(filePath, 3600)

  if (error) throw error

  return data.signedUrl
}

async function canAccessFile(
  filePath: string,
  userId: string,
  requesterId: string,
) {
  // File owner can access
  if (userId === requesterId) return true

  // Admins can access all files
  const requester = await getUser(requesterId)
  if (hasRole(requester, 'admin')) return true

  // Check if file is part of public submission
  const submission = await db.submission.findFirst({
    where: {
      userId,
      attachments: { path: filePath },
      visibility: 'public',
      status: 'approved',
    },
  })

  return !!submission
}
```

## Privacy Policies

### Data Collection

We collect minimal data necessary for program operation:

**Required Data:**

- Email (for authentication and communication)
- Name (for recognition and certificates)
- School affiliation (for program tracking)

**Optional Data:**

- Profile photo (via Google OAuth)
- Additional contact information
- Evidence files and descriptions

### Data Usage

Data is used only for:

1. **Program Administration**: Tracking progress, awarding points
2. **Recognition**: Public leaderboards (with consent)
3. **Communication**: Program updates and notifications
4. **Analytics**: Aggregate program metrics (anonymized)

### Data Sharing

**Internal Sharing:**

- Microsoft Indonesia (program sponsor)
- Authorized reviewers (for submission approval)
- Platform administrators (for support)

**External Sharing:**

- None, except as required by law
- Aggregate, anonymized metrics may be shared publicly

### User Rights

Users have the right to:

1. **Access**: View all their data
2. **Rectification**: Correct inaccurate data
3. **Erasure**: Delete their account and data
4. **Portability**: Export their data
5. **Restriction**: Limit processing of their data

```typescript
// Data export for user
async function exportUserData(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  const submissions = await db.submission.findMany({ where: { userId } })
  const points = await db.pointsLedger.findMany({ where: { userId } })
  const badges = await db.earnedBadge.findMany({ where: { userId } })

  return {
    user,
    submissions,
    points,
    badges,
    exportedAt: new Date().toISOString(),
  }
}

// Account deletion
async function deleteUserAccount(userId: string) {
  // Anonymize instead of hard delete to preserve program metrics
  await db.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@example.com`,
      name: 'Deleted User',
      handle: `deleted-${userId}`,
      school: 'Deleted',
      deletedAt: new Date(),
    },
  })

  // Delete files
  await deleteUserFiles(userId)

  // Log deletion
  await logAuditEvent('account_deleted', { userId })
}
```

## Audit Logging

### Audit Events

All sensitive operations are logged:

```typescript
interface AuditEvent {
  id: string
  actor: string // User who performed action
  action: string // What was done
  target?: string // What was affected
  metadata: object // Additional context
  timestamp: Date
  ipAddress?: string
  userAgent?: string
}

// Audit logging function
async function logAuditEvent(
  action: string,
  metadata: object,
  actor?: string,
  target?: string,
) {
  const event: AuditEvent = {
    id: crypto.randomUUID(),
    actor: actor || 'system',
    action,
    target,
    metadata,
    timestamp: new Date(),
    ipAddress: getClientIP(),
    userAgent: getUserAgent(),
  }

  await db.auditEvent.create({ data: event })
}
```

### Monitored Actions

- User role changes
- Submission approvals/rejections
- Data exports
- Account deletions
- Admin console access
- File uploads/downloads

## Security Monitoring

### Error Tracking

Sentry integration for security-related errors:

```typescript
import * as Sentry from '@sentry/nextjs'

// Security event reporting
function reportSecurityEvent(event: string, context: object) {
  Sentry.addBreadcrumb({
    category: 'security',
    message: event,
    level: 'warning',
    data: context,
  })

  Sentry.captureMessage(`Security event: ${event}`, 'warning')
}

// Usage
reportSecurityEvent('unauthorized_access_attempt', {
  userId: 'user123',
  resource: '/admin/users',
  ip: '192.168.1.1',
})
```

### Rate Limiting

Prevent abuse with rate limiting:

```typescript
// Rate limiting configuration
const rateLimits = {
  api: { requests: 1000, window: '1h' },
  upload: { requests: 100, window: '1h' },
  auth: { requests: 10, window: '15m' },
}

// Rate limit middleware
async function rateLimit(request: Request, limit: RateLimit) {
  const key = getRateLimitKey(request)
  const count = await incrementRateLimit(key, limit.window)

  if (count > limit.requests) {
    throw new RateLimitError('Too many requests')
  }
}
```

## Incident Response

### Security Incident Types

1. **Data Breach**: Unauthorized access to user data
2. **Authentication Bypass**: Circumvention of auth controls
3. **Privilege Escalation**: Unauthorized role elevation
4. **File Access**: Unauthorized file downloads
5. **API Abuse**: Excessive or malicious API usage

### Response Procedures

1. **Immediate**: Block the threat, preserve evidence
2. **Assessment**: Determine scope and impact
3. **Notification**: Inform stakeholders and users if required
4. **Remediation**: Fix vulnerabilities, restore services
5. **Post-mortem**: Document lessons learned

### Contact Information

- **Security Team**: security@elevate.org
- **Platform Team**: platform@elevate.org
- **Emergency**: [emergency-contact]

## Compliance

### Data Protection Regulations

The platform is designed to comply with:

- **GDPR**: European data protection regulation
- **Indonesian Data Protection**: Local privacy laws
- **Microsoft Privacy Standards**: Corporate requirements

### Regular Reviews

- **Quarterly**: Security policy review
- **Annually**: Penetration testing
- **Continuous**: Vulnerability scanning
- **As needed**: Incident response updates

---

_This security guide is a living document. Report security concerns to the security team immediately._
