# @elevate/db

Database package for the MS Elevate LEAPS Tracker application. Provides type-safe database access, schema management, and migration tooling using Prisma.

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
  include: { submissions: true }
})

// Transactions
await db.$transaction([
  db.submission.create({ data: submissionData }),
  db.pointsLedger.create({ data: pointsData })
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

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate:dev` | Create and apply development migration |
| `pnpm db:migrate` | Apply migrations (production) |
| `pnpm db:migrate:reset` | Reset database (⚠️ destroys data) |
| `pnpm db:seed` | Seed database with default data |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `pnpm db:push` | Push schema changes (dev only) |

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
  Role 
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

## Contributing

1. Follow the [migration guide](./MIGRATIONS.md) for schema changes
2. Update seed data when adding new required fields
3. Add tests for new utility functions
4. Document breaking changes in pull requests

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