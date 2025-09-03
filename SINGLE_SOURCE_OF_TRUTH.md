# Single Source of Truth: Database Schema Management

## Overview

This document establishes the new approach for managing database schema in the MS Elevate LEAPS Tracker project, ensuring Prisma schema serves as the canonical source of truth while maintaining Supabase-specific features.

## Architecture Decision

### Prisma as the Single Source of Truth

**Decision**: The Prisma schema (`packages/db/schema.prisma`) is the authoritative definition of the database structure.

**Rationale**:
- Type-safe database access throughout the application
- Automatic TypeScript type generation
- Consistent schema validation and introspection
- Better developer experience with IDE support
- Migration generation from schema changes

### Supabase Migrations for Deployment

**Decision**: Supabase migrations in `supabase/migrations/` handle deployment to the hosted database.

**Rationale**:
- Supabase CLI provides reliable deployment tooling
- RLS policies and auth functions require Supabase-specific SQL
- Storage and auth integrations are Supabase-specific
- Production deployment consistency

## Workflow

### 1. Schema Changes

All schema changes MUST follow this process:

1. **Update Prisma Schema**: Modify `packages/db/schema.prisma`
2. **Generate Prisma Migration**: Run `npx prisma migrate dev --name descriptive_name`
3. **Create Supabase Migration**: Create corresponding migration in `supabase/migrations/`
4. **Test Locally**: Verify changes work in development
5. **Deploy**: Use Supabase CLI to deploy to staging/production

### 2. Migration Naming Convention

#### Prisma Migrations
- Location: `packages/db/migrations/`
- Format: `NNN_descriptive_name.sql`
- Numbers: Sequential (001, 002, 003...)

#### Supabase Migrations  
- Location: `supabase/migrations/`
- Format: `YYYYMMDDHHMMSS_descriptive_name.sql`
- Timestamp: UTC timestamp for ordering

### 3. Content Guidelines

#### Prisma Migrations Should Contain:
- Core table structure (CREATE TABLE, ALTER TABLE)
- Indexes for performance
- Foreign key constraints
- Business logic triggers and functions
- Custom constraints and validations

#### Supabase Migrations Should Contain:
- Everything from corresponding Prisma migration
- RLS policies (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- Auth helper functions (e.g., `get_user_role()`)
- Storage bucket configurations
- Materialized views for performance
- Supabase-specific extensions

## File Structure

```
/elevate/
├── packages/db/
│   ├── schema.prisma           # 🔑 CANONICAL SOURCE
│   └── migrations/
│       ├── 001_init.sql
│       ├── 002_views.sql
│       ├── 003_constraints.sql
│       ├── 004_amplify_quota.sql
│       ├── 005_submission_attachments.sql
│       └── 006_kajabi_contact_id.sql
└── supabase/
    └── migrations/
        ├── 20250902000001_initial_schema.sql
        ├── 20250902000002_materialized_views.sql
        ├── 20250903120000_schema_consolidation.sql
        └── 20250903125000_harmonize_materialized_views.sql
```

## Verification Process

### Before Deployment

1. **Schema Consistency Check**:
   ```bash
   # Run verification script
   psql $DATABASE_URL -f verify-schema-sync.sql
   ```

2. **Type Generation**:
   ```bash
   # Ensure Prisma types are current
   npx prisma generate
   ```

3. **Local Testing**:
   ```bash
   # Test migrations locally
   supabase db reset --local
   ```

### After Deployment

1. **Production Verification**:
   ```bash
   # Check production schema
   psql $PROD_DATABASE_URL -f verify-schema-sync.sql
   ```

2. **Materialized View Refresh**:
   ```sql
   SELECT refresh_leaderboards();
   ```

## Emergency Procedures

### Schema Drift Detection

If schemas become out of sync:

1. **Stop Deployments**: Prevent further drift
2. **Run Verification**: Use `verify-schema-sync.sql` to identify differences
3. **Create Alignment Migration**: Add missing elements to bring schemas in sync
4. **Test Thoroughly**: Verify in staging before production

### Rollback Process

If deployment fails:

1. **Use Rollback Script**: Run `rollback-schema-consolidation.sql`
2. **Verify State**: Ensure database is in known-good state
3. **Investigate Issue**: Identify root cause of failure
4. **Fix and Retry**: Address issue and attempt deployment again

## Best Practices

### DO ✅

- Always update Prisma schema first
- Create corresponding Supabase migrations for every Prisma migration
- Use descriptive migration names
- Test migrations in development before production
- Backup database before major schema changes
- Document breaking changes in migration comments

### DON'T ❌

- Modify database schema directly in production
- Create Supabase migrations without corresponding Prisma changes
- Skip the verification process
- Deploy unested migrations
- Mix schema changes with data changes in same migration

## Troubleshooting

### Common Issues

1. **"Table already exists" errors**: Use `IF NOT EXISTS` clauses
2. **Index conflicts**: Check for existing indexes before creation
3. **RLS policy conflicts**: Drop existing policies before recreating
4. **Migration ordering**: Ensure dependencies are created first

### Debug Commands

```bash
# Check Prisma schema status
npx prisma migrate status

# Inspect database schema
supabase db inspect

# View migration history
psql $DATABASE_URL -c "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;"
```

## Migration Templates

### Adding a New Table

#### Prisma Migration
```sql
-- Add new_table to support feature X
CREATE TABLE "new_table" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_new_table_name" ON "new_table"("name");
```

#### Supabase Migration
```sql
-- Add new_table to support feature X (with RLS)
CREATE TABLE "new_table" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_new_table_name" ON "new_table"("name");

-- Enable RLS
ALTER TABLE "new_table" ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "new_table_select_all" ON "new_table"
    FOR SELECT USING (true);
```

## Conclusion

This single-source-of-truth approach ensures:

- ✅ **Consistency**: Prisma schema as canonical definition
- ✅ **Safety**: Rollback procedures and verification scripts
- ✅ **Flexibility**: Supabase-specific features when needed
- ✅ **Reliability**: Tested migration process
- ✅ **Maintainability**: Clear procedures and documentation

Following this process prevents schema drift and ensures reliable deployments across all environments.