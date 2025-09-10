# @elevate/db

Database package for the MS Elevate LEAPS Tracker application. Provides type-safe database access, schema management, and migration tooling using Prisma.

> 📚 **Documentation**: See [Database Hub](../../docs/README.md#backend--database) for comprehensive guides on schema, migrations, and operations.

## Features

- **Type-safe database operations** via Prisma Client
- **Schema-driven development** with automatic type generation
- **Prisma Migrate** for version-controlled schema changes
- **Materialized views** for high-performance leaderboards
- **Business logic enforcement** via database triggers and constraints
- **Anti-gaming measures** with quota limits and validation rules

## Quick Start

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Apply migrations to development database
pnpm db:migrate:dev

# Seed database with default data
pnpm db:seed
```

## Usage

### In Application Code

```typescript
import { db } from '@elevate/db/client'

// Type-safe queries
const users = await db.user.findMany({
  where: { role: 'PARTICIPANT' },
  include: { submissions: true },
})

// Transactions
await db.$transaction([
  db.submission.create({ data: submissionData }),
  db.pointsLedger.create({ data: pointsData }),
])
```

### Database Operations

```bash
# Development workflow
pnpm db:migrate:dev --name add_new_feature  # Create and apply migration
pnpm db:generate                           # Update Prisma client
pnpm db:studio                             # Open database GUI

# Production deployment
pnpm db:migrate                            # Apply pending migrations
pnpm db:migrate:status                     # Check migration status
```

## Schema Overview

### Core Entities

- **User** - Participant profiles with Clerk authentication integration
- **Activity** - LEAPS stage definitions (LEARN, EXPLORE, AMPLIFY, PRESENT, SHINE)
- **Submission** - Evidence submissions with approval workflow
- **PointsLedger** - Append-only point tracking for complete audit trail

### Supporting Entities

- **Badge** / **EarnedBadge** - Achievement system
- **SubmissionAttachment** - File attachment metadata
- **KajabiEvent** - Webhook integration tracking
- **AuditLog** - System action logging

## Migration from Legacy SQL

This package has been migrated from hand-written SQL migrations to Prisma Migrate. The consolidated baseline migration `20250904011005_init_consolidated` includes:

- All database tables, indexes, and constraints
- Materialized views for performance (leaderboards, metrics)
- Business logic triggers (AMPLIFY quota enforcement)
- Anti-gaming constraints (one active LEARN submission per user)

Legacy SQL migrations are preserved in `migrations_legacy_sql/` for reference.

## Performance Features

### Materialized Views

- **leaderboard_totals** - All-time point rankings
- **leaderboard_30d** - 30-day rolling rankings
- **activity_metrics** - Per-stage submission statistics

Refresh via: `SELECT refresh_leaderboards();`

### Business Logic

- **AMPLIFY Quota Limits** - 50 peers, 200 students per 7-day period
- **LEARN Submission Limits** - One active submission per user
- **External Event Deduplication** - Kajabi webhook idempotency

## Environment Setup

Required environment variables:

```bash
# Primary database connection
DATABASE_URL="postgresql://user:pass@host:5432/elevate_dev"

# Optional: Direct connection for migrations (bypasses pooling)
DIRECT_URL="postgresql://user:pass@host:5432/elevate_dev"
```

## Development Commands

| Command                 | Description                            |
| ----------------------- | -------------------------------------- |
| `pnpm db:generate`      | Generate Prisma client                 |
| `pnpm db:migrate:dev`   | Create and apply development migration |
| `pnpm db:migrate`       | Apply migrations (production)          |
| `pnpm db:migrate:reset` | Reset database (⚠️ destroys data)      |
| `pnpm db:seed`          | Seed database with default data        |
| `pnpm db:studio`        | Open Prisma Studio GUI                 |
| `pnpm db:push`          | Push schema changes (dev only)         |

### Leaderboard Search Indexes (Trigram)

The web leaderboard supports partial text search on `name`/`school` using `ILIKE`. To keep search fast at scale we enable `pg_trgm` and add GIN trigram indexes on the materialized views. These are created in `scripts/post-migrate.sql` and run automatically after Prisma migrations.

To apply:

```
pnpm -C elevate -F @elevate/db db:migrate
```

### EXPLAIN Helpers

Validate query plans used by the app with EXPLAIN on representative queries:

```sql
-- Leaderboard totals with name search
EXPLAIN (ANALYZE, BUFFERS)
SELECT lb.user_id, lb.handle, lb.name, lb.school, lb.total_points
FROM leaderboard_totals lb
WHERE name ILIKE '%ahmad%' OR handle ILIKE '%ahmad%' OR school ILIKE '%jakarta%'
ORDER BY lb.total_points DESC, COALESCE(lb.last_activity_at, '1970-01-01'::timestamp) DESC
LIMIT 20 OFFSET 0;

-- 30d leaderboard search
EXPLAIN (ANALYZE, BUFFERS)
SELECT lb.user_id, lb.handle, lb.name, lb.school, lb.total_points
FROM leaderboard_30d lb
WHERE name ILIKE '%ahmad%' OR handle ILIKE '%ahmad%' OR school ILIKE '%jakarta%'
ORDER BY lb.total_points DESC, COALESCE(lb.last_activity_at, '1970-01-01'::timestamp) DESC
LIMIT 20 OFFSET 0;

-- Stage metrics time series
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  TO_CHAR(created_at, 'YYYY-MM') AS month,
  COUNT(*)::int AS submissions,
  COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approvals
FROM submissions
WHERE activity_code = 'LEARN'
GROUP BY 1
ORDER BY 1;
```

Expect GIN trgm index scans for the name/school filters and appropriate sort strategies on ordered columns.

### Backfill Learn Tag Grants

We provide a supervised backfill script to populate `learn_tag_grants` from Kajabi events (tag names: `elevate-ai-1-completed`, `elevate-ai-2-completed`).

- Dry run (prints planned inserts):

```
pnpm -C elevate -F @elevate/db db:backfill-learn-tags --limit 1000 --offset 0
```

- Apply changes:

```
pnpm -C elevate -F @elevate/db db:backfill-learn-tags --apply --limit 1000 --offset 0
```

The script is idempotent and only inserts grants that do not already exist.

## Testing

```bash
# Run database tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## Type Safety

The package exports comprehensive TypeScript types:

```typescript
import type {
  User,
  Submission,
  PointsLedger,
  SubmissionStatus,
  Role,
} from '@elevate/db'

// Prisma client with full type safety
import { db } from '@elevate/db/client'

// Utility functions
import { calculateUserTotalPoints } from '@elevate/db/utils'
```

## Best Practices

### Schema Changes

1. Always update `schema.prisma` first
2. Generate migration with descriptive name
3. Review generated SQL before committing
4. Test on staging before production deployment

### Queries

1. Use Prisma's type-safe query API
2. Include only needed fields for performance
3. Use transactions for multi-table operations
4. Leverage materialized views for complex aggregations

### Migrations

1. Test with realistic data volumes
2. Use `CREATE INDEX CONCURRENTLY` for large tables
3. Add columns with safe defaults
4. Document business logic in migration comments

## Architecture Integration

This package is consumed by:

- **apps/web** - Public site and participant dashboard
- **apps/admin** - Reviewer and admin console
- **packages/auth** - Role-based access control integration

## Monitoring

Key metrics to monitor:

- Migration deployment success rate
- Materialized view refresh duration
- Query performance on leaderboard views
- Constraint violation patterns (anti-gaming triggers)

## JSON Payload Mapping

### Important: Database JSON Storage Format

The database stores JSON payloads in **snake_case** format, while the API layer accepts and returns **camelCase**. This separation is handled by DTO mappers in `@elevate/types`.

#### Database JSON Fields (snake_case)

- **LEARN**: `course_name`, `certificate_url`, `certificate_hash`, `completed_at`
- **EXPLORE**: `class_date`, `evidence_files`
- **AMPLIFY**: `peers_trained`, `students_trained`, `attendance_proof_files`
- **PRESENT**: `linkedin_url`, `screenshot_url`
- **SHINE**: `idea_title`, `idea_summary`

#### API Fields (camelCase)

- **LEARN**: `courseName`, `certificateUrl`, `certificateHash`, `completedAt`
- **EXPLORE**: `classDate`, `evidenceFiles`
- **AMPLIFY**: `peersTrained`, `studentsTrained`, `attendanceProofFiles`
- **PRESENT**: `linkedinUrl`, `screenshotUrl`
- **SHINE**: `ideaTitle`, `ideaSummary`

#### Using DTO Mappers

```typescript
import {
  transformPayloadAPIToDB,
  transformPayloadDBToAPI,
} from '@elevate/types'

// Before writing to database
const dbPayload = transformPayloadAPIToDB('LEARN', apiPayload)
await db.submission.create({
  data: {
    payload: dbPayload,
    // ... other fields
  },
})

// When reading from database
const submission = await db.submission.findUnique({ where: { id } })
const apiPayload = transformPayloadDBToAPI(
  submission.activity_code,
  submission.payload,
)
```

## Contributing

1. Follow the [migration guide](./MIGRATIONS.md) for schema changes
2. Update seed data when adding new required fields
3. Add tests for new utility functions
4. Document breaking changes in pull requests
5. Ensure JSON payloads use snake_case in database, camelCase in API

## Support

For issues related to:

- **Schema design** - Consult the [main project documentation](../../CLAUDE.md)
- **Migration problems** - See [MIGRATIONS.md](./MIGRATIONS.md)
- **Performance tuning** - Check materialized view refresh patterns
- **Business logic** - Review trigger implementations in migration files

---

**Package Version**: 0.1.0  
**Prisma Version**: 6.15+  
**PostgreSQL Compatibility**: 14+  
**Last Updated**: 2025-01-04
