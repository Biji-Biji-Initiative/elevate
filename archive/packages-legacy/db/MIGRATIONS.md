# Database Migrations Guide

## Overview

The @elevate/db package now uses **Prisma Migrate** as the source of truth for database schema changes. This migration from hand-written SQL migrations to Prisma Migrate ensures better type safety, automated rollback capabilities, and improved development workflow.

## Migration History

### Legacy SQL Migrations (Archived)

The following SQL migrations have been consolidated into the initial Prisma migration:

- `001_init.sql` - Initial schema creation with all base tables
- `002_views.sql` - Materialized views for leaderboards and activity metrics
- `003_constraints.sql` - Business logic constraints (LEARN submission limits, external event uniqueness)
- `004_amplify_quota.sql` - Anti-gaming triggers for AMPLIFY submissions
- `005_submission_attachments.sql` - Relational attachments table
- `006_kajabi_contact_id.sql` - Added Kajabi contact ID to users
- `007_drop_attachments_json.sql` - Removed deprecated JSON attachments column

**Location**: `/packages/db/migrations_legacy_sql/` (archived for reference)

### Current Prisma Migrations

#### `20250904011005_init_consolidated`
**Consolidates all legacy migrations into a single baseline**

- ✅ All base tables (users, activities, submissions, etc.)
- ✅ All enums (Role, SubmissionStatus, Visibility, LedgerSource)
- ✅ All indexes and foreign key constraints
- ✅ Business logic constraints (LEARN submission limits)
- ✅ Anti-gaming triggers (AMPLIFY quota enforcement)
- ✅ Materialized views (leaderboards, activity metrics)
- ✅ Helper functions (refresh_leaderboards)

## Development Workflow

### Making Schema Changes

1. **Update `schema.prisma`** with your changes
2. **Generate migration** in development:
   ```bash
   pnpm db:migrate:dev --name your_descriptive_name
   ```
3. **Review generated SQL** in the migration file
4. **Test migration** locally before committing

### Common Operations

#### Development
```bash
# Generate Prisma client after schema changes
pnpm db:generate

# Create and apply a new migration
pnpm db:migrate:dev --name add_new_feature

# Reset database (WARNING: destroys data)
pnpm db:migrate:reset --force

# Seed database with default data
pnpm db:seed

# Full reset and seed
pnpm db:reset
```

#### Production Deployment
```bash
# Apply pending migrations (safe for production)
pnpm db:migrate

# Check migration status
pnpm db:migrate:status

# Manual resolution if needed
pnpm db:migrate:resolve --rolled-back migration_name
```

#### Development Tools
```bash
# Open Prisma Studio
pnpm db:studio

# Push schema changes without migration (development only)
pnpm db:push

# Pull schema from existing database
pnpm db:pull
```

## Best Practices

### Migration Safety

1. **Always backup before production migrations**
2. **Test migrations on staging environment first**
3. **Use transactions for complex changes**
4. **Include rollback instructions in comments**

### Writing Migrations

#### ✅ Good Migration Examples

```sql
-- Add column with safe default
ALTER TABLE "users" ADD COLUMN "timezone" TEXT DEFAULT 'UTC';

-- Create index concurrently (PostgreSQL)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_users_created_at" 
ON "users"("created_at");

-- Add constraint with validation period
ALTER TABLE "submissions" ADD CONSTRAINT "check_payload_not_empty" 
CHECK (jsonb_array_length(payload) > 0) NOT VALID;
```

#### ❌ Dangerous Migration Patterns

```sql
-- Don't: Drop columns without backup
ALTER TABLE "users" DROP COLUMN "old_column";

-- Don't: Blocking index creation on large tables
CREATE INDEX "idx_blocking" ON "large_table"("column");

-- Don't: Non-nullable columns without default
ALTER TABLE "users" ADD COLUMN "required_field" TEXT NOT NULL;
```

### Schema Design Guidelines

1. **Use descriptive migration names**: `add_user_preferences_table` not `update`
2. **Group related changes**: Don't split logical changes across migrations
3. **Include comments**: Explain business logic, especially for constraints
4. **Version carefully**: Breaking changes require major version bump

## Custom SQL in Migrations

### Materialized Views

Materialized views are included in migrations for performance:

```sql
-- Create materialized view
CREATE MATERIALIZED VIEW leaderboard_totals AS
SELECT u.id, u.handle, SUM(pl.delta_points) as total_points
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id
GROUP BY u.id, u.handle;

-- Index for performance
CREATE INDEX idx_leaderboard_totals_points 
ON leaderboard_totals(total_points DESC);
```

### Business Logic Triggers

Anti-gaming measures implemented via triggers:

```sql
CREATE OR REPLACE FUNCTION check_amplify_quota() RETURNS trigger AS $$
BEGIN
  -- Validation logic here
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_amplify_quota
BEFORE INSERT ON submissions
FOR EACH ROW EXECUTE PROCEDURE check_amplify_quota();
```

### Unique Constraints

Complex business rules via partial indexes:

```sql
-- Only one active LEARN submission per user
CREATE UNIQUE INDEX uniq_learn_active_submission
ON submissions (user_id)
WHERE activity_code = 'LEARN' AND status IN ('PENDING', 'APPROVED');
```

## Troubleshooting

### Common Issues

#### Migration State Mismatch
```bash
# Check current state
pnpm db:migrate:status

# If needed, mark as applied without running
pnpm db:migrate:resolve --applied migration_name
```

#### Schema Drift Detection
```bash
# Compare schema.prisma with database
pnpm db:pull
# Review differences and create migration if needed
```

#### Failed Migration Recovery
```bash
# Mark migration as rolled back
pnpm db:migrate:resolve --rolled-back migration_name

# Fix the migration file
# Re-apply
pnpm db:migrate:dev
```

### Production Deployment Checklist

- [ ] Test migration on staging with production data volume
- [ ] Backup database before migration
- [ ] Run migration with monitoring
- [ ] Verify application functionality post-migration
- [ ] Refresh materialized views if needed:
  ```sql
  SELECT refresh_leaderboards();
  ```

## Environment Variables

Required for migration operations:

```bash
# Direct database connection for migrations
DATABASE_URL="postgresql://user:pass@host:5432/db"
# Optional: Direct connection bypassing connection pooler
DIRECT_URL="postgresql://user:pass@host:5432/db"
```

## Schema Documentation

### Core Tables

- **users**: Participant profiles with Clerk integration
- **activities**: LEAPS stage definitions (LEARN, EXPLORE, AMPLIFY, PRESENT, SHINE)
- **submissions**: Evidence submissions with approval workflow
- **points_ledger**: Append-only point tracking for audit trail
- **submission_attachments**: Relational file attachments

### Supporting Tables

- **badges**: Achievement definitions
- **earned_badges**: User badge associations
- **kajabi_events**: Webhook event tracking
- **audit_log**: System action logging

### Performance Views

- **leaderboard_totals**: All-time point rankings
- **leaderboard_30d**: 30-day rolling point rankings
- **activity_metrics**: Per-stage submission statistics

## Migration Rollback Strategy

### Automatic Rollback (Development)
```bash
pnpm db:migrate:reset --force
pnpm db:migrate:dev
```

### Manual Rollback (Production)
1. Stop application traffic
2. Restore from backup
3. Update migration tracking table
4. Restart application

### Forward-Only Approach (Recommended)
Instead of rollbacks, create new migrations to fix issues:
```bash
pnpm db:migrate:dev --name fix_previous_migration
```

## Integration with Applications

### Web App (`apps/web`)
- Uses `@elevate/db/client` for database queries
- Automatic client generation via postinstall hook
- Materialized view refresh via API endpoints

### Admin App (`apps/admin`)
- Direct database operations for admin functions
- Migration status monitoring
- Bulk operations with proper transaction handling

## Monitoring and Maintenance

### Regular Tasks

1. **Materialized View Refresh** (automated):
   ```sql
   SELECT refresh_leaderboards(); -- Run every 15 minutes
   ```

2. **Migration Status Monitoring**:
   ```bash
   pnpm db:migrate:status
   ```

3. **Performance Monitoring**:
   - Query performance on materialized views
   - Index usage statistics
   - Constraint violation patterns

## Future Considerations

### Potential Enhancements

1. **Multi-tenant Schema**: Partition by region/cohort
2. **Read Replicas**: Separate read/write operations
3. **Sharding Strategy**: Scale beyond single database
4. **CDC Integration**: Real-time data sync

### Schema Evolution

As the LEAPS framework evolves:

1. New activity types: Extend `activities` enum
2. Additional evidence types: Flexible JSON schemas
3. Advanced scoring: Complex point calculation rules
4. Internationalization: Multi-language content support

---

**Last Updated**: 2025-01-04  
**Schema Version**: v1.0.0 (Prisma Migrate baseline)  
**Compatibility**: Prisma 6.15+, PostgreSQL 14+