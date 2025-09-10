# Database Troubleshooting Guide

## Overview

This guide provides step-by-step troubleshooting procedures for common issues in the MS Elevate LEAPS Tracker database system. Issues are organized by category with diagnostic steps, root cause analysis, and resolution procedures.

## Table of Contents

1. [Connection Issues](#connection-issues)
2. [Migration Problems](#migration-problems)
3. [Performance Issues](#performance-issues)
4. [Data Integrity Problems](#data-integrity-problems)
5. [Materialized View Issues](#materialized-view-issues)
6. [Business Logic Violations](#business-logic-violations)
7. [Authentication & Authorization](#authentication--authorization)
8. [Webhook Integration Issues](#webhook-integration-issues)
9. [Analytics & Reporting Problems](#analytics--reporting-problems)
10. [Emergency Recovery](#emergency-recovery)

## Connection Issues

### Cannot Connect to Database

#### Symptoms
- Application shows database connection errors
- Prisma Client throws `PrismaClientInitializationError`
- Health check endpoints fail
- Database operations timeout

#### Diagnostic Steps

1. **Verify Environment Variables**
   ```bash
   echo $DATABASE_URL
   echo $DIRECT_URL
   
   # Check format
   # Expected: postgresql://user:password@host:port/database
   ```

2. **Test Direct Connection**
   ```bash
   # Test connection
   psql $DATABASE_URL -c "SELECT version();"
   
   # Check if database exists
   psql $DATABASE_URL -c "SELECT current_database();"
   ```

3. **Check Supabase Status**
   ```bash
   # Check API status
   curl -I https://your-project.supabase.co/rest/v1/
   
   # Visit status page
   open https://status.supabase.com/
   ```

#### Common Root Causes & Solutions

##### 1. Invalid Connection String
```bash
# ❌ Common mistakes
DATABASE_URL=postgresql://user@host/db  # Missing port
DATABASE_URL=postgres://user:pass@host:5432/db  # Wrong protocol

# ✅ Correct format
DATABASE_URL=postgresql://postgres.user:password@aws-0-region.pooler.supabase.com:5432/postgres
```

##### 2. Connection Pool Exhaustion
```sql
-- Check active connections
SELECT 
  state,
  COUNT(*) as connection_count
FROM pg_stat_activity 
GROUP BY state;

-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' 
  AND now() - state_change > interval '10 minutes';
```

##### 3. Firewall/Network Issues
```bash
# Test port connectivity
telnet your-host.supabase.co 5432

# Test via different network
curl -v telnet://your-host.supabase.co:5432
```

##### 4. SSL Certificate Issues
```bash
# Test with SSL disabled (diagnostic only)
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=disable"

# Check SSL certificate
openssl s_client -connect your-host.supabase.co:5432 -starttls postgres
```

### Connection Pool Issues

#### Symptoms
- Intermittent connection timeouts
- "Connection pool timeout" errors
- Slow database operations
- Application hangs on database calls

#### Diagnostic Steps
```sql
-- Monitor connection pool usage
SELECT 
  state,
  COUNT(*) as connections,
  MAX(now() - state_change) as max_idle_time
FROM pg_stat_activity
WHERE pid != pg_backend_pid()
GROUP BY state;

-- Check for long-running queries
SELECT 
  pid,
  now() - query_start as duration,
  query,
  state
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '1 minute'
ORDER BY duration DESC;
```

#### Solutions

##### 1. Increase Connection Pool Size
```typescript
// prisma/client.ts
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Increase connection pool
  __internal: {
    engine: {
      connectionTimeout: 20000,
      maxQueryDuration: 60000,
    },
  },
});
```

##### 2. Implement Connection Retry Logic
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Connection retry wrapper
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Migration Problems

### Migration Failures

#### Symptoms
- `pnpm db:migrate` fails with errors
- Schema mismatch between database and Prisma
- Migration gets stuck in failed state
- Foreign key constraint errors during migration

#### Diagnostic Steps

1. **Check Migration Status**
   ```bash
   pnpm db:migrate:status
   ```

2. **Examine Migration History**
   ```sql
   SELECT * FROM _prisma_migrations 
   ORDER BY finished_at DESC LIMIT 10;
   ```

3. **Validate Current Schema**
   ```bash
   pnpm db:pull
   # Compare pulled schema with schema.prisma
   ```

#### Common Solutions

##### 1. Failed Migration Rollback
```bash
# Mark failed migration as rolled back
pnpm db:migrate:resolve --rolled-back "20250904123000_migration_name"

# Apply migration again
pnpm db:migrate
```

##### 2. Manual Migration Fix
```sql
-- Fix schema manually
ALTER TABLE table_name ADD COLUMN new_column TEXT;

-- Mark migration as applied
pnpm db:migrate:resolve --applied "20250904123000_migration_name"
```

##### 3. Reset Migration State
```bash
# ⚠️ DEVELOPMENT ONLY - Data loss occurs
pnpm db:migrate:reset --force

# Re-seed data
pnpm db:seed
```

### Schema Drift Issues

#### Symptoms
- Prisma client errors about unknown fields
- Database has extra columns not in schema
- Type errors in application code

#### Resolution
```bash
# Pull current database schema
pnpm db:pull

# Create migration for differences
pnpm db:migrate:dev --name fix_schema_drift

# Regenerate client
pnpm db:generate
```

## Performance Issues

### Slow Queries

#### Symptoms
- Database operations timeout
- High response times in application
- CPU usage spikes
- Users report slow page loads

#### Diagnostic Steps

1. **Identify Slow Queries**
   ```sql
   -- Check current active queries
   SELECT 
     pid,
     now() - query_start as duration,
     query,
     wait_event_type,
     wait_event
   FROM pg_stat_activity
   WHERE state = 'active'
     AND query NOT ILIKE '%pg_stat_activity%'
   ORDER BY duration DESC;
   ```

2. **Analyze Query Plans**
   ```sql
   -- Example: Analyze leaderboard query
   EXPLAIN (ANALYZE, BUFFERS) 
   SELECT * FROM leaderboard_totals 
   ORDER BY total_points DESC 
   LIMIT 20;
   ```

3. **Check Index Usage**
   ```sql
   -- Find unused indexes
   SELECT 
     schemaname,
     tablename,
     indexname,
     idx_scan,
     idx_tup_read
   FROM pg_stat_user_indexes
   WHERE idx_scan = 0
     AND schemaname = 'public';
   ```

#### Performance Optimization

##### 1. Add Missing Indexes
```sql
-- Common performance indexes
CREATE INDEX CONCURRENTLY idx_submissions_user_activity 
ON submissions(user_id, activity_code, status);

CREATE INDEX CONCURRENTLY idx_points_ledger_user_created 
ON points_ledger(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_submissions_created_status 
ON submissions(created_at, status) WHERE status = 'PENDING';
```

##### 2. Optimize Materialized Views
```sql
-- Check view refresh performance
EXPLAIN (ANALYZE, BUFFERS) 
REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_totals;

-- Optimize view queries
CREATE INDEX idx_mv_leaderboard_user_points 
ON leaderboard_totals(user_id, total_points);
```

##### 3. Query Rewriting
```typescript
// ❌ Slow: N+1 query problem
const submissions = await prisma.submission.findMany();
for (const submission of submissions) {
  const user = await prisma.user.findUnique({ 
    where: { id: submission.user_id } 
  });
}

// ✅ Fast: Single query with join
const submissions = await prisma.submission.findMany({
  include: {
    user: {
      select: { id: true, name: true, handle: true }
    }
  }
});
```

### Memory Issues

#### Symptoms
- Out of memory errors
- Application restarts unexpectedly
- Slow garbage collection
- High memory usage in monitoring

#### Solutions

##### 1. Optimize Large Queries
```typescript
// ❌ Load all records into memory
const allSubmissions = await prisma.submission.findMany({
  include: { user: true, activity: true }
});

// ✅ Use pagination/streaming
const PAGE_SIZE = 100;
for (let page = 0; page < totalPages; page++) {
  const submissions = await prisma.submission.findMany({
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { user: true, activity: true }
  });
  
  // Process batch
  await processBatch(submissions);
}
```

##### 2. Implement Query Limits
```typescript
// Add reasonable default limits
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export async function getSubmissions(
  page = 1, 
  limit = DEFAULT_LIMIT
) {
  const safeLimit = Math.min(limit, MAX_LIMIT);
  
  return prisma.submission.findMany({
    skip: (page - 1) * safeLimit,
    take: safeLimit,
    orderBy: { created_at: 'desc' }
  });
}
```

## Data Integrity Problems

### Orphaned Records

#### Symptoms
- Foreign key constraint errors
- References to non-existent records
- Data inconsistencies in reports
- Application errors when loading related data

#### Diagnostic Queries
```sql
-- Find orphaned submissions
SELECT s.id, s.user_id, s.activity_code
FROM submissions s
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN activities a ON s.activity_code = a.code
WHERE u.id IS NULL OR a.code IS NULL;

-- Find orphaned points
SELECT pl.id, pl.user_id, pl.activity_code
FROM points_ledger pl
LEFT JOIN users u ON pl.user_id = u.id
LEFT JOIN activities a ON pl.activity_code = a.code
WHERE u.id IS NULL OR a.code IS NULL;

-- Find orphaned attachments
SELECT sa.id, sa.submission_id
FROM submission_attachments sa
LEFT JOIN submissions s ON sa.submission_id = s.id
WHERE s.id IS NULL;
```

#### Cleanup Procedures
```sql
-- ⚠️ Backup before cleanup
CREATE TABLE orphaned_data_backup AS (
  -- Select orphaned records
  SELECT * FROM submissions WHERE user_id NOT IN (SELECT id FROM users)
);

-- Remove orphaned records
DELETE FROM submissions 
WHERE user_id NOT IN (SELECT id FROM users);

DELETE FROM points_ledger 
WHERE user_id NOT IN (SELECT id FROM users);

DELETE FROM submission_attachments 
WHERE submission_id NOT IN (SELECT id FROM submissions);
```

### Duplicate Data

#### Symptoms
- Constraint violation errors
- Duplicate entries in leaderboard
- Multiple LEARN submissions per user
- Inconsistent point totals

#### Detection & Resolution
```sql
-- Find duplicate LEARN submissions (violates business rule)
SELECT user_id, COUNT(*) as learn_count
FROM submissions
WHERE activity_code = 'LEARN' 
  AND status IN ('PENDING', 'APPROVED')
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Find duplicate external events
SELECT external_event_id, COUNT(*) as duplicate_count
FROM points_ledger
WHERE external_event_id IS NOT NULL
GROUP BY external_event_id
HAVING COUNT(*) > 1;

-- Cleanup duplicates (keep latest)
WITH ranked_submissions AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, activity_code 
      ORDER BY created_at DESC
    ) as rn
  FROM submissions
  WHERE activity_code = 'LEARN'
)
DELETE FROM submissions
WHERE id IN (
  SELECT id FROM ranked_submissions WHERE rn > 1
);
```

### Point Calculation Errors

#### Symptoms
- User points don't match submissions
- Negative point totals (unexpected)
- Leaderboard inconsistencies
- Point audit failures

#### Diagnostic Steps
```sql
-- Compare submission-based vs ledger-based points
WITH submission_points AS (
  SELECT 
    s.user_id,
    s.activity_code,
    COUNT(*) FILTER (WHERE s.status = 'APPROVED') as approved_count,
    a.default_points,
    (COUNT(*) FILTER (WHERE s.status = 'APPROVED') * a.default_points) as expected_points
  FROM submissions s
  JOIN activities a ON s.activity_code = a.code
  WHERE a.default_points > 0
  GROUP BY s.user_id, s.activity_code, a.default_points
),
ledger_points AS (
  SELECT 
    user_id,
    activity_code,
    SUM(delta_points) as actual_points
  FROM points_ledger
  GROUP BY user_id, activity_code
)
SELECT 
  sp.user_id,
  sp.activity_code,
  sp.expected_points,
  COALESCE(lp.actual_points, 0) as actual_points,
  (sp.expected_points - COALESCE(lp.actual_points, 0)) as difference
FROM submission_points sp
LEFT JOIN ledger_points lp ON sp.user_id = lp.user_id 
  AND sp.activity_code = lp.activity_code
WHERE sp.expected_points != COALESCE(lp.actual_points, 0);
```

#### Point Reconciliation
```sql
-- Recreate points from approved submissions
INSERT INTO points_ledger (user_id, activity_code, source, delta_points)
SELECT 
  s.user_id,
  s.activity_code,
  'RECONCILIATION' as source,
  a.default_points as delta_points
FROM submissions s
JOIN activities a ON s.activity_code = a.code
WHERE s.status = 'APPROVED'
  AND a.default_points > 0
  AND NOT EXISTS (
    SELECT 1 FROM points_ledger pl 
    WHERE pl.user_id = s.user_id 
      AND pl.activity_code = s.activity_code
      AND pl.source = 'FORM'
  );
```

## Materialized View Issues

### View Refresh Failures

#### Symptoms
- `refresh_all_analytics()` function fails
- Stale data in leaderboard
- View queries return errors
- Missing data in analytics

#### Diagnostic Steps
```sql
-- Check view status
SELECT 
  schemaname,
  matviewname,
  hasindexes,
  ispopulated
FROM pg_matviews 
WHERE schemaname = 'public';

-- Check for blocking locks
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity 
  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity 
  ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

#### Resolution Steps

##### 1. Force View Refresh
```sql
-- Kill blocking queries
SELECT pg_terminate_backend(blocking_pid);

-- Refresh views individually
REFRESH MATERIALIZED VIEW activity_metrics;
REFRESH MATERIALIZED VIEW leaderboard_totals;
REFRESH MATERIALIZED VIEW leaderboard_30d;
REFRESH MATERIALIZED VIEW cohort_metrics;
REFRESH MATERIALIZED VIEW school_metrics;
REFRESH MATERIALIZED VIEW time_series_metrics;
```

##### 2. Recreate Corrupted Views
```sql
-- Drop and recreate problematic view
DROP MATERIALIZED VIEW leaderboard_totals CASCADE;

-- Recreate from migration SQL
CREATE MATERIALIZED VIEW leaderboard_totals AS
-- (Include full view definition from migration)

-- Recreate indexes
CREATE INDEX idx_leaderboard_totals_points 
ON leaderboard_totals(total_points DESC);
```

### Missing View Data

#### Symptoms
- Empty leaderboard results
- Zero counts in analytics
- Users not appearing in views despite having data

#### Troubleshooting
```sql
-- Check base data exists
SELECT COUNT(*) FROM users WHERE role = 'PARTICIPANT';
SELECT COUNT(*) FROM submissions WHERE status = 'APPROVED';
SELECT COUNT(*) FROM points_ledger;

-- Verify view logic step by step
SELECT 
  u.id,
  u.handle,
  COUNT(DISTINCT s.id) as submissions,
  COALESCE(SUM(pl.delta_points), 0) as points
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id
LEFT JOIN submissions s ON u.id = s.user_id
WHERE u.role = 'PARTICIPANT'
GROUP BY u.id, u.handle
HAVING COALESCE(SUM(pl.delta_points), 0) > 0 OR COUNT(s.id) > 0
ORDER BY points DESC;
```

## Business Logic Violations

### AMPLIFY Quota Exceeded

#### Symptoms
- Users cannot submit AMPLIFY forms
- Trigger error: "Peer training limit exceeded"
- API returns 500 errors on AMPLIFY submissions

#### Diagnostic Steps
```sql
-- Check user's 7-day AMPLIFY totals
SELECT 
  u.name,
  u.handle,
  SUM((s.payload->>'peersTrained')::int) as total_peers,
  SUM((s.payload->>'studentsTrained')::int) as total_students,
  COUNT(*) as amplify_submissions
FROM submissions s
JOIN users u ON s.user_id = u.id
WHERE s.activity_code = 'AMPLIFY'
  AND s.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
  AND u.handle = 'user_handle_here'
GROUP BY u.id, u.name, u.handle;
```

#### Solutions

##### 1. Adjust Quota Limits (if business rules change)
```sql
-- Temporarily disable trigger for emergency fixes
DROP TRIGGER IF EXISTS trg_check_amplify_quota ON submissions;

-- Modify quota limits in function
CREATE OR REPLACE FUNCTION check_amplify_quota() 
RETURNS trigger AS $$
DECLARE
  total_peers INTEGER;
  total_students INTEGER;
  new_peers INTEGER;
  new_students INTEGER;
BEGIN
  -- Increased limits (change 50 to new limit)
  IF (total_peers + new_peers) > 75 THEN  -- Was 50
    RAISE EXCEPTION 'Peer training limit exceeded';
  END IF;
  -- ... rest of function
END;
$$ LANGUAGE plpgsql;

-- Re-enable trigger
CREATE TRIGGER trg_check_amplify_quota
BEFORE INSERT ON submissions
FOR EACH ROW
EXECUTE PROCEDURE check_amplify_quota();
```

##### 2. Manual Override (emergency cases)
```sql
-- Allow specific submission bypassing quota
-- First, disable trigger temporarily
DROP TRIGGER trg_check_amplify_quota ON submissions;

-- Insert submission manually
INSERT INTO submissions (user_id, activity_code, status, payload, ...)
VALUES (...);

-- Re-enable trigger
CREATE TRIGGER trg_check_amplify_quota
BEFORE INSERT ON submissions
FOR EACH ROW
EXECUTE PROCEDURE check_amplify_quota();
```

### Multiple LEARN Submissions

#### Symptoms
- Unique constraint violation on LEARN submissions
- Users have multiple approved LEARN certificates
- Business rule violation alerts

#### Resolution
```sql
-- Find violating users
SELECT 
  user_id,
  COUNT(*) as learn_submissions,
  array_agg(id) as submission_ids
FROM submissions
WHERE activity_code = 'LEARN' 
  AND status IN ('PENDING', 'APPROVED')
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Keep latest, reject others
WITH ranked_learns AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id 
      ORDER BY created_at DESC
    ) as rn
  FROM submissions
  WHERE activity_code = 'LEARN'
    AND status IN ('PENDING', 'APPROVED')
)
UPDATE submissions
SET 
  status = 'REJECTED',
  review_note = 'Duplicate LEARN submission - keeping latest only'
WHERE id IN (
  SELECT id FROM ranked_learns WHERE rn > 1
);
```

## Authentication & Authorization

### Role Permission Issues

#### Symptoms
- Users cannot access admin features
- RBAC checks fail
- Unauthorized access attempts
- Role synchronization problems with Clerk

#### Diagnostic Steps
```sql
-- Check user roles
SELECT id, name, email, role, created_at 
FROM users 
WHERE email = 'user@example.com';

-- Check role distribution
SELECT role, COUNT(*) as user_count 
FROM users 
GROUP BY role;

-- Find users with invalid roles
SELECT * FROM users 
WHERE role NOT IN ('PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN');
```

#### Solutions

##### 1. Fix Role Assignment
```sql
-- Promote user to reviewer
UPDATE users 
SET role = 'REVIEWER' 
WHERE email = 'reviewer@example.com';

-- Demote user to participant
UPDATE users 
SET role = 'PARTICIPANT' 
WHERE id = 'user_id_here';
```

##### 2. Bulk Role Updates
```sql
-- Promote multiple users to reviewers
UPDATE users 
SET role = 'REVIEWER' 
WHERE email IN (
  'reviewer1@example.com',
  'reviewer2@example.com',
  'reviewer3@example.com'
);
```

### User Synchronization Issues

#### Symptoms
- New users not appearing in database
- User data mismatch between Clerk and database
- Authentication works but user data missing

#### Resolution
```typescript
// Sync user from Clerk webhook
export async function syncUserFromClerk(clerkUser: any) {
  try {
    await prisma.user.upsert({
      where: { id: clerkUser.id },
      update: {
        name: `${clerkUser.first_name} ${clerkUser.last_name}`.trim(),
        email: clerkUser.email_addresses[0]?.email_address,
        avatar_url: clerkUser.image_url,
        // Don't override role if already set
      },
      create: {
        id: clerkUser.id,
        handle: generateUniqueHandle(clerkUser.email_addresses[0]?.email_address),
        name: `${clerkUser.first_name} ${clerkUser.last_name}`.trim(),
        email: clerkUser.email_addresses[0]?.email_address,
        avatar_url: clerkUser.image_url,
        role: 'PARTICIPANT',
      },
    });
  } catch (error) {
    console.error('User sync failed:', error);
    throw error;
  }
}
```

## Webhook Integration Issues

### Kajabi Webhook Failures

#### Symptoms
- LEARN certificates not auto-awarding points
- Webhook events showing as unprocessed
- 500 errors on webhook endpoint
- Duplicate point awards

#### Diagnostic Steps
```sql
-- Check unprocessed webhook events
SELECT 
  id,
  received_at,
  processed_at,
  user_match,
  payload->>'event_type' as event_type
FROM kajabi_events
WHERE processed_at IS NULL
ORDER BY received_at DESC;

-- Check for processing errors
SELECT 
  id,
  payload->>'email' as email,
  payload->>'product_name' as course,
  user_match
FROM kajabi_events
WHERE processed_at IS NULL
  AND received_at < NOW() - INTERVAL '1 hour';
```

#### Solutions

##### 1. Reprocess Failed Webhooks
```typescript
// Reprocess webhook events
export async function reprocessKajabiEvents() {
  const unprocessedEvents = await prisma.kajabiEvent.findMany({
    where: { processed_at: null },
    orderBy: { received_at: 'asc' }
  });

  for (const event of unprocessedEvents) {
    try {
      await processKajabiEvent(event);
      console.log(`✅ Processed event ${event.id}`);
    } catch (error) {
      console.error(`❌ Failed to process event ${event.id}:`, error);
    }
  }
}

async function processKajabiEvent(event: any) {
  const email = event.payload.email?.toLowerCase();
  if (!email) throw new Error('No email in event');

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    // Mark as no user match
    await prisma.kajabiEvent.update({
      where: { id: event.id },
      data: { 
        processed_at: new Date(),
        user_match: 'NO_USER_FOUND'
      }
    });
    return;
  }

  // Award points (idempotent via external_event_id)
  await prisma.pointsLedger.create({
    data: {
      user_id: user.id,
      activity_code: 'LEARN',
      source: 'WEBHOOK',
      delta_points: 20,
      external_source: 'kajabi',
      external_event_id: event.id
    }
  });

  // Mark event as processed
  await prisma.kajabiEvent.update({
    where: { id: event.id },
    data: { 
      processed_at: new Date(),
      user_match: user.id
    }
  });
}
```

##### 2. Handle Duplicate Events
```sql
-- Remove duplicate events (same payload)
WITH duplicate_events AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY payload 
      ORDER BY received_at ASC
    ) as rn
  FROM kajabi_events
)
DELETE FROM kajabi_events
WHERE id IN (
  SELECT id FROM duplicate_events WHERE rn > 1
);
```

### Email Matching Issues

#### Symptoms
- Users exist but webhooks show "NO_USER_FOUND"
- Case sensitivity problems in email matching
- Users with multiple email addresses

#### Solutions
```sql
-- Check email case mismatches
SELECT 
  ke.id,
  ke.payload->>'email' as webhook_email,
  u.email as user_email
FROM kajabi_events ke
LEFT JOIN users u ON LOWER(u.email) = LOWER(ke.payload->>'email')
WHERE ke.user_match = 'NO_USER_FOUND'
  AND u.id IS NOT NULL;

-- Update case-insensitive matching
UPDATE kajabi_events
SET user_match = u.id
FROM users u
WHERE kajabi_events.user_match = 'NO_USER_FOUND'
  AND LOWER(u.email) = LOWER(kajabi_events.payload->>'email');
```

## Analytics & Reporting Problems

### Leaderboard Inconsistencies

#### Symptoms
- Users missing from leaderboard despite having points
- Point totals don't match individual calculations
- Ranking order incorrect
- Performance issues loading leaderboard

#### Diagnostic Steps
```sql
-- Compare materialized view vs live calculation
WITH live_totals AS (
  SELECT 
    u.id,
    u.handle,
    COALESCE(SUM(pl.delta_points), 0) as live_points
  FROM users u
  LEFT JOIN points_ledger pl ON u.id = pl.user_id
  WHERE u.role = 'PARTICIPANT'
  GROUP BY u.id, u.handle
)
SELECT 
  lt.user_id,
  lt.handle,
  lt.total_points as mv_points,
  live.live_points,
  (live.live_points - lt.total_points) as difference
FROM leaderboard_totals lt
FULL OUTER JOIN live_totals live ON lt.user_id = live.id
WHERE COALESCE(lt.total_points, 0) != COALESCE(live.live_points, 0);
```

#### Solutions
```sql
-- Force refresh all analytics
SELECT refresh_all_analytics();

-- Check for materialized view corruption
DROP MATERIALIZED VIEW leaderboard_totals CASCADE;
-- Recreate from migration SQL
-- Refresh all views
SELECT refresh_all_analytics();
```

### Missing Analytics Data

#### Symptoms
- Zero counts in dashboards
- Empty cohort/school metrics
- Time series showing no data
- Export files empty

#### Resolution
```sql
-- Check data exists in base tables
SELECT 
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'submissions', COUNT(*) FROM submissions
UNION ALL
SELECT 'points_ledger', COUNT(*) FROM points_ledger;

-- Verify view population
SELECT COUNT(*) FROM leaderboard_totals;
SELECT COUNT(*) FROM activity_metrics;
SELECT COUNT(*) FROM cohort_metrics;

-- Repopulate if needed
SELECT refresh_all_analytics();
```

### Export Functionality Issues

#### Symptoms
- CSV exports timeout
- Data missing from exports
- Memory errors during large exports
- Malformed CSV output

#### Solutions
```typescript
// Streaming CSV export for large datasets
import { Readable } from 'stream';
import { stringify } from 'csv-stringify';

export async function streamLeaderboardExport() {
  const stream = new Readable({ objectMode: true });
  
  // Use cursor-based pagination
  let cursor: string | undefined = undefined;
  const BATCH_SIZE = 1000;
  
  const fetchBatch = async () => {
    const results = await prisma.leaderboardTotals.findMany({
      take: BATCH_SIZE,
      ...(cursor && {
        skip: 1,
        cursor: { user_id: cursor }
      }),
      orderBy: { total_points: 'desc' }
    });
    
    return results;
  };
  
  // Stream data in batches
  (async () => {
    try {
      let batch = await fetchBatch();
      
      while (batch.length > 0) {
        for (const record of batch) {
          stream.push(record);
        }
        
        cursor = batch[batch.length - 1].user_id;
        batch = await fetchBatch();
      }
      
      stream.push(null); // End stream
    } catch (error) {
      stream.destroy(error);
    }
  })();
  
  return stream.pipe(stringify({ header: true }));
}
```

## Emergency Recovery

### Complete Database Corruption

#### Immediate Actions
1. **Stop all write operations** - Scale application to zero
2. **Assess damage scope** - Check which tables are affected
3. **Restore from backup** - Use latest Supabase backup
4. **Verify data integrity** - Run consistency checks
5. **Restart applications** - Bring systems back online

#### Recovery Steps
```bash
# 1. Stop applications
kubectl scale deployment elevate-web --replicas=0
kubectl scale deployment elevate-admin --replicas=0

# 2. Restore database (via Supabase Dashboard)
# Navigate to Settings > Database > Backups
# Select restore point and confirm

# 3. Verify restoration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM submissions;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM points_ledger;"

# 4. Refresh materialized views
psql $DATABASE_URL -c "SELECT refresh_all_analytics();"

# 5. Run health checks
curl -f "$STAGING_URL/api/health/database"

# 6. Restart applications
kubectl scale deployment elevate-web --replicas=2
kubectl scale deployment elevate-admin --replicas=1
```

### Point-in-Time Recovery

#### Recovery Process
```bash
# 1. Create recovery database
createdb elevate_recovery

# 2. Restore to specific point in time
# (Via Supabase Dashboard or pg_basebackup for self-hosted)

# 3. Extract recent data
pg_dump elevate_recovery \
  --data-only \
  --table=submissions \
  --table=points_ledger \
  --where="created_at >= '2025-09-04 10:00:00'" \
  > recent_data.sql

# 4. Apply recent data to production
psql $DATABASE_URL < recent_data.sql

# 5. Reconcile conflicts
# Run data integrity checks
# Fix any constraint violations
```

### Data Loss Scenarios

#### User Data Recovery
```sql
-- Recover user data from audit logs
INSERT INTO users (id, name, email, handle, role)
SELECT DISTINCT
  (meta->>'user_id')::text as id,
  (meta->>'name')::text as name,
  (meta->>'email')::text as email,
  (meta->>'handle')::text as handle,
  'PARTICIPANT' as role
FROM audit_log
WHERE action = 'user_created'
  AND (meta->>'user_id') NOT IN (SELECT id FROM users);
```

#### Submission Recovery
```sql
-- Recover submissions from webhook events and audit logs
INSERT INTO submissions (id, user_id, activity_code, status, payload)
SELECT 
  gen_random_uuid() as id,
  u.id as user_id,
  'LEARN' as activity_code,
  'APPROVED' as status,
  jsonb_build_object(
    'certificate_url', ke.payload->'certificate_url',
    'course_name', ke.payload->'product_name',
    'recovery_source', 'kajabi_webhook'
  ) as payload
FROM kajabi_events ke
JOIN users u ON u.email = LOWER(ke.payload->>'email')
WHERE ke.processed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM submissions s
    WHERE s.user_id = u.id AND s.activity_code = 'LEARN'
  );
```

### Communication Templates

#### User Notification (Data Loss)
```
Subject: MS Elevate Platform - Service Update

Dear Elevate Participant,

We experienced a technical issue that may have affected your recent submissions or points. Our team has restored the system and recovered most data.

What we've done:
✅ Restored your profile and basic information
✅ Recovered approved submissions from the last 7 days
✅ Recalculated your leaderboard position

What you may need to do:
📝 Check your dashboard for missing submissions
📝 Resubmit any evidence from the last 24 hours
📝 Contact support if your points seem incorrect

We apologize for the inconvenience and appreciate your patience.

Best regards,
MS Elevate Team
```

#### Technical Team Alert
```
🚨 DATABASE RECOVERY COMPLETED

Duration: 2h 15m
Affected: All users
Data Loss: < 24 hours

Recovery Summary:
- Users: 100% recovered
- Submissions: 98% recovered (latest 24h may need resubmission)
- Points: 99% recovered via webhook replay
- Analytics: Rebuilt from source data

Next Steps:
1. Monitor error rates next 4 hours
2. User communication sent
3. Support team briefed on recovery process
4. Post-mortem scheduled for tomorrow 2 PM

On-call: @technical-lead
```

### Recovery Verification

#### Data Consistency Checks
```sql
-- Post-recovery validation
WITH validation_checks AS (
  SELECT 'User count' as metric, COUNT(*)::text as value FROM users
  UNION ALL
  SELECT 'Submission count', COUNT(*)::text FROM submissions
  UNION ALL
  SELECT 'Points entries', COUNT(*)::text FROM points_ledger
  UNION ALL
  SELECT 'Approved submissions', COUNT(*)::text FROM submissions WHERE status = 'APPROVED'
  UNION ALL
  SELECT 'Top user points', MAX(total_points)::text FROM leaderboard_totals
)
SELECT * FROM validation_checks;

-- Check referential integrity
SELECT 'Orphaned submissions' as issue, COUNT(*) as count
FROM submissions s LEFT JOIN users u ON s.user_id = u.id WHERE u.id IS NULL
UNION ALL
SELECT 'Orphaned points', COUNT(*)
FROM points_ledger pl LEFT JOIN users u ON pl.user_id = u.id WHERE u.id IS NULL
UNION ALL
SELECT 'Orphaned attachments', COUNT(*)
FROM submission_attachments sa LEFT JOIN submissions s ON sa.submission_id = s.id WHERE s.id IS NULL;
```

### Contact Information

- **Emergency Hotline**: +62-xxx-xxxx-xxxx
- **Database Team**: db-team@mereka.org  
- **Technical Lead**: tech-lead@mereka.org
- **Support Team**: support@mereka.org
- **Escalation**: CTO@mereka.org

### Recovery SLAs

- **Detection**: < 15 minutes
- **Initial Response**: < 30 minutes  
- **Communication**: < 1 hour
- **Resolution**: < 4 hours
- **Full Recovery**: < 8 hours