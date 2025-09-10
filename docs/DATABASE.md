---
title: Database Schema - Actual Prisma Models
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [database, schema, prisma]
---

## Database Schema - Actual Prisma Models

Complete database schema based on the **real** Prisma schema at `packages/db/schema.prisma`.

## Overview

- **Database**: PostgreSQL via Supabase
- **ORM**: Prisma Client
- **Models**: 11 core models
- **Location**: `packages/db/schema.prisma`

## Core Models

### User (Educators)

```prisma
model User {
  id                String   @id
  handle            String   @unique
  name              String
  email             String   @unique
  avatar_url        String?
  role              Role     @default(PARTICIPANT)
  user_type         UserType @default(EDUCATOR)
  school            String?
  cohort            String?
  kajabi_contact_id String?  @unique
  created_at        DateTime @default(now())

  // Relations
  earned_badges        EarnedBadge[]
  ledger              PointsLedger[]
  learn_tag_grants    LearnTagGrant[]
  submissions         Submission[]
  reviewed_submissions Submission[] @relation("ReviewedSubmissions")
}

enum Role {
  PARTICIPANT  // Default for educators
  REVIEWER     // Can approve submissions
  ADMIN        // Full admin access
  SUPERADMIN   // System administration
}
```

### Submissions (Evidence)

```prisma
model Submission {
  id              String           @id @default(cuid())
  user_id         String
  activity_code   String
  status          SubmissionStatus @default(PENDING)
  visibility      Visibility       @default(PRIVATE)
  payload         Json             // Evidence data
  attachments_rel SubmissionAttachment[]
  reviewer_id     String?
  review_note     String?
  created_at      DateTime         @default(now())
  updated_at      DateTime         @updatedAt
}

enum SubmissionStatus {
  PENDING   // Awaiting review
  APPROVED  // Approved by reviewer
  REJECTED  // Rejected by reviewer
}
```

### Points System

```prisma
model PointsLedger {
  id                String       @id @default(cuid())
  user_id           String
  activity_code     String
  source            LedgerSource
  delta_points      Int          // Points awarded/deducted
  external_source   String?      // "kajabi", "manual"
  external_event_id String?
  event_time        DateTime
  meta              Json         @default("{}")
  created_at        DateTime     @default(now())
}

enum LedgerSource {
  SUBMISSION_APPROVAL  // From approved submission
  KAJABI_WEBHOOK      // From Kajabi course completion
  MANUAL_ADJUSTMENT   // Admin adjustment
  BADGE_AWARD         // From badge award
}
```

### Activities (LEAPS Stages)

```prisma
model Activity {
  code           String @id
  name           String
  default_points Int
}
```

**Standard Activities:**

- `learn` - Complete AI course (20 points)
- `explore` - Apply AI in classroom (50 points)
- `amplify` - Run training session (variable points)
- `present` - Share story on LinkedIn (20 points)
- `shine` - Recognition activity

### Kajabi Integration

```prisma
model KajabiEvent {
  id             String   @id @default(cuid())
  event_id       String   // Kajabi event ID
  tag_name_raw   String   // Original tag name
  tag_name_norm  String   @db.Citext
  contact_id     String   // Kajabi contact ID
  email          String?
  created_at_utc DateTime
  status         String   // Processing status
  raw            Json     // Full webhook payload
}

model LearnTagGrant {
  user_id   String
  tag_name  String   @db.Citext
  granted_at DateTime @default(now())
}
```

## Database Commands

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations (dev)
pnpm db:migrate

# Deploy migrations (prod)
pnpm db:migrate:prod

# Push schema changes (dev only)
pnpm db:push

# Seed with test data
pnpm db:seed

# Open Prisma Studio
pnpm db:studio

# Check schema drift
pnpm db:check-drift

# Reset database (dev only)
pnpm db:reset
```

## Common Queries

### User Points Total

```typescript
const totalPoints = await prisma.pointsLedger.aggregate({
  where: { user_id: userId },
  _sum: { delta_points: true },
})
```

### Leaderboard

```typescript
const leaderboard = await prisma.$queryRaw`
  SELECT u.handle, u.name, SUM(pl.delta_points) as total_points
  FROM users u
  LEFT JOIN points_ledger pl ON u.id = pl.user_id  
  GROUP BY u.id, u.handle, u.name
  ORDER BY total_points DESC
  LIMIT 20
`
```

### Pending Reviews

```typescript
const pending = await prisma.submission.findMany({
  where: { status: 'PENDING' },
  include: { user: true, activity: true },
  orderBy: { created_at: 'asc' },
})
```

## Security

- **Row Level Security**: Supabase policies restrict data access
- **PII Protection**: Email, name, school are restricted fields
- **File Security**: Attachments use signed URLs
- **Audit Logging**: All admin actions logged

---

_Schema reflects actual production database as of 2025-09-10._
