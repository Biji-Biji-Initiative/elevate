# Database Operations Manual

## Overview

The @elevate/db package provides database operations for the MS Elevate LEAPS Tracker platform, supporting Indonesian educators' AI learning journey through a structured 5-stage progression system (Learn, Explore, Amplify, Present, Shine).

## Table of Contents

1. [Database Architecture](#database-architecture)
2. [Environment Configuration](#environment-configuration)
3. [Database Operations](#database-operations)
4. [Materialized Views Management](#materialized-views-management)
5. [Data Integrity & Constraints](#data-integrity--constraints)
6. [Performance Operations](#performance-operations)
7. [Backup & Recovery](#backup--recovery)
8. [Monitoring & Alerting](#monitoring--alerting)
9. [CI/CD Integration](#cicd-integration)
10. [Emergency Procedures](#emergency-procedures)

## Database Architecture

### Core Schema Components

```
PostgreSQL Database (Supabase)
├── Core Tables
│   ├── users (Clerk integration, role-based access)
│   ├── activities (LEAPS stages: LEARN, EXPLORE, AMPLIFY, PRESENT, SHINE)
│   ├── submissions (evidence with status workflow)
│   ├── points_ledger (append-only scoring system)
│   ├── badges & earned_badges (achievement system)
│   ├── submission_attachments (file references)
│   ├── kajabi_events (webhook integration)
│   └── audit_log (compliance & security)
├── Materialized Views
│   ├── leaderboard_totals (all-time rankings)
│   ├── leaderboard_30d (rolling monthly rankings)
│   ├── activity_metrics (per-stage analytics)
│   ├── cohort_metrics (cohort performance)
│   ├── school_metrics (institutional analytics)
│   └── time_series_metrics (trend analysis)
└── Business Logic
    ├── AMPLIFY quota trigger (7-day limits)
    ├── Unique constraint for LEARN submissions
    └── Point calculation functions
```

### Key Design Principles

- **Append-Only Ledger**: Points tracking via immutable ledger for audit trail
- **Materialized Views**: Performance optimization for analytics and leaderboards
- **Role-Based Access**: PARTICIPANT, REVIEWER, ADMIN, SUPERADMIN hierarchy
- **Anti-Gaming**: Quota limits and duplicate detection for submission integrity
- **Indonesian Context**: Cohort and school-based organization for cascading training model

## Environment Configuration

### Required Environment Variables

```bash
# Core Database Connection
DATABASE_URL=postgresql://user:password@host:port/database
DIRECT_URL=postgresql://user:password@host:port/database?pgbouncer=true

# Supabase Configuration
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE=eyJ...
SUPABASE_ANON_KEY=eyJ...

# Application Context
NEXT_PUBLIC_SITE_URL=https://leaps.mereka.org
NODE_ENV=production

# Seed Configuration (Optional)
SEED_ADMIN_ID=user_2abc123
SEED_ADMIN_EMAIL=admin@mereka.org
SEED_ADMIN_NAME="Platform Admin"
SEED_ADMIN_HANDLE=admin
```

### Connection Pool Configuration

```bash
# Connection Pooling (Supabase)
PGBOUNCER_ENABLED=true
MAX_CONNECTIONS=20
POOL_TIMEOUT=10
IDLE_TIMEOUT=600
```

## Database Operations

### Schema Management

#### Apply Migrations
```bash
# Development
pnpm db:migrate:dev

# Production
pnpm db:migrate

# Check migration status
pnpm db:migrate:status

# Rollback (if rollback.sql exists)
cd migrations/{migration_folder}
psql $DATABASE_URL -f rollback.sql
```

#### Schema Generation
```bash
# Generate Prisma client
pnpm db:generate

# Push schema changes (development only)
pnpm db:push

# Pull schema from database
pnpm db:pull
```

### Database Seeding

#### Initial Setup
```bash
# Seed activities, badges, and admin user
pnpm db:seed

# Reset and reseed (development only)
pnpm db:reset
```

#### Manual Seeding Operations
```sql
-- Seed LEAPS activities
INSERT INTO activities (code, name, default_points) VALUES
('LEARN', 'Learn', 20),
('EXPLORE', 'Explore', 50),
('AMPLIFY', 'Amplify', 0),
('PRESENT', 'Present', 20),
('SHINE', 'Shine', 0);

-- Create admin user
INSERT INTO users (id, handle, name, email, role) VALUES
('admin_id', 'admin', 'Admin User', 'admin@example.com', 'ADMIN');
```

### Data Operations

#### User Management
```sql
-- Promote user to reviewer
UPDATE users SET role = 'REVIEWER' WHERE email = 'reviewer@example.com';

-- List all admins
SELECT id, name, email, role, created_at 
FROM users 
WHERE role IN ('ADMIN', 'SUPERADMIN');

-- Check user activity summary
SELECT * FROM get_user_point_summary('user_id_here');
```

#### Submission Operations
```sql
-- Review queue for admins
SELECT s.id, u.name, u.email, a.name as activity, s.status, s.created_at
FROM submissions s
JOIN users u ON s.user_id = u.id
JOIN activities a ON s.activity_code = a.code
WHERE s.status = 'PENDING'
ORDER BY s.created_at ASC;

-- Approve submission and award points
UPDATE submissions 
SET status = 'APPROVED', reviewer_id = 'reviewer_id' 
WHERE id = 'submission_id';

INSERT INTO points_ledger (user_id, activity_code, source, delta_points)
VALUES ('user_id', 'LEARN', 'FORM', 20);
```

#### Points Management
```sql
-- User points summary
SELECT 
  u.name,
  u.handle,
  SUM(pl.delta_points) as total_points,
  COUNT(DISTINCT pl.activity_code) as activities_completed
FROM users u
JOIN points_ledger pl ON u.id = pl.user_id
WHERE u.id = 'user_id'
GROUP BY u.id, u.name, u.handle;

-- Activity-wise points breakdown
SELECT 
  a.name,
  COUNT(*) as entries,
  SUM(pl.delta_points) as total_points
FROM points_ledger pl
JOIN activities a ON pl.activity_code = a.code
WHERE pl.user_id = 'user_id'
GROUP BY a.code, a.name;
```

## Materialized Views Management

### Refresh Operations

#### Manual Refresh
```sql
-- Refresh all analytics views
SELECT refresh_all_analytics();

-- Individual view refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_totals;
REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_30d;
REFRESH MATERIALIZED VIEW CONCURRENTLY activity_metrics;
```

#### Scheduled Refresh (Recommended)
```bash
# Setup cron job for regular refresh (every 5 minutes)
*/5 * * * * psql $DATABASE_URL -c "SELECT refresh_all_analytics();"

# Or via application scheduler
# Vercel Cron: GET /api/cron/refresh-analytics
```

#### View Monitoring
```sql
-- Check view freshness
SELECT 
  schemaname,
  matviewname,
  hasindexes,
  ispopulated,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews
WHERE schemaname = 'public';

-- View row counts
SELECT 'leaderboard_totals' as view, COUNT(*) FROM leaderboard_totals
UNION ALL
SELECT 'leaderboard_30d', COUNT(*) FROM leaderboard_30d
UNION ALL
SELECT 'activity_metrics', COUNT(*) FROM activity_metrics;
```

### Performance Optimization

#### Index Management
```sql
-- Monitor index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Rebuild indexes if needed
REINDEX INDEX CONCURRENTLY idx_leaderboard_totals_points;
```

## Data Integrity & Constraints

### Business Rule Enforcement

#### AMPLIFY Quota Monitoring
```sql
-- Check AMPLIFY quota usage
SELECT 
  u.name,
  u.handle,
  SUM((s.payload->>'peersTrained')::int) as total_peers,
  SUM((s.payload->>'studentsTrained')::int) as total_students
FROM submissions s
JOIN users u ON s.user_id = u.id
WHERE s.activity_code = 'AMPLIFY'
  AND s.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY u.id, u.name, u.handle
HAVING 
  SUM((s.payload->>'peersTrained')::int) > 40 OR
  SUM((s.payload->>'studentsTrained')::int) > 150;
```

#### LEARN Constraint Validation
```sql
-- Verify one active LEARN per user
SELECT user_id, COUNT(*) as active_learns
FROM submissions
WHERE activity_code = 'LEARN' 
  AND status IN ('PENDING', 'APPROVED')
GROUP BY user_id
HAVING COUNT(*) > 1;
```

#### External Event Deduplication
```sql
-- Check for external event collisions
SELECT external_event_id, COUNT(*) as duplicates
FROM points_ledger
WHERE external_event_id IS NOT NULL
GROUP BY external_event_id
HAVING COUNT(*) > 1;
```

### Data Quality Checks

#### Daily Health Check
```sql
-- Comprehensive data quality check
WITH health_checks AS (
  SELECT 
    'Users without handle' as check_name,
    COUNT(*) as issue_count
  FROM users WHERE handle IS NULL OR handle = ''
  
  UNION ALL
  
  SELECT 
    'Submissions without user',
    COUNT(*)
  FROM submissions s
  LEFT JOIN users u ON s.user_id = u.id
  WHERE u.id IS NULL
  
  UNION ALL
  
  SELECT 
    'Points without user',
    COUNT(*)
  FROM points_ledger pl
  LEFT JOIN users u ON pl.user_id = u.id
  WHERE u.id IS NULL
  
  UNION ALL
  
  SELECT 
    'Orphaned attachments',
    COUNT(*)
  FROM submission_attachments sa
  LEFT JOIN submissions s ON sa.submission_id = s.id
  WHERE s.id IS NULL
)
SELECT * FROM health_checks WHERE issue_count > 0;
```

## Performance Operations

### Query Optimization

#### Slow Query Identification
```sql
-- Enable query logging (if accessible)
-- ALTER SYSTEM SET log_statement = 'all';
-- ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Monitor active queries
SELECT 
  now() - query_start as duration,
  query,
  state,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE state = 'active' 
  AND query NOT ILIKE '%pg_stat_activity%'
ORDER BY duration DESC;
```

#### Index Recommendations
```sql
-- Missing indexes (requires pg_stat_statements)
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1;
```

### Cache Management

#### Connection Pool Monitoring
```sql
-- Check connection usage
SELECT 
  state,
  COUNT(*) as connections
FROM pg_stat_activity
GROUP BY state;

-- Kill long-running queries (emergency)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '10 minutes'
  AND query NOT ILIKE '%REFRESH MATERIALIZED VIEW%';
```

## Backup & Recovery

### Backup Strategy

#### Automated Supabase Backups
- **Daily automatic backups** (retained for 7 days on free tier)
- **Weekly backups** (retained for 4 weeks on pro tier)
- **Point-in-time recovery** available for pro tier

#### Manual Backup Operations
```bash
# Full database dump
pg_dump $DATABASE_URL > elevate_backup_$(date +%Y%m%d_%H%M%S).sql

# Schema-only backup
pg_dump --schema-only $DATABASE_URL > elevate_schema_$(date +%Y%m%d).sql

# Data-only backup
pg_dump --data-only $DATABASE_URL > elevate_data_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -Fc $DATABASE_URL > elevate_backup_$(date +%Y%m%d).dump
```

#### Critical Data Export
```sql
-- Export user data (GDPR compliance)
\COPY (
  SELECT u.*, 
    array_agg(DISTINCT s.id) as submission_ids,
    array_agg(DISTINCT pl.id) as point_entries
  FROM users u
  LEFT JOIN submissions s ON u.id = s.user_id
  LEFT JOIN points_ledger pl ON u.id = pl.user_id
  WHERE u.email = 'user@example.com'
  GROUP BY u.id
) TO 'user_export.csv' WITH CSV HEADER;

-- Export leaderboard snapshot
\COPY (
  SELECT * FROM leaderboard_totals 
  ORDER BY total_points DESC LIMIT 100
) TO 'leaderboard_snapshot.csv' WITH CSV HEADER;
```

### Recovery Procedures

#### Point-in-Time Recovery
```bash
# Restore to specific timestamp (Supabase Dashboard)
# Navigate to Settings > Database > Backups
# Select restore point and confirm

# Manual restore from dump
createdb elevate_restore
pg_restore -d elevate_restore elevate_backup.dump
```

#### Data Recovery Scenarios

##### Accidental Point Deletion
```sql
-- Recreate points from approved submissions
INSERT INTO points_ledger (user_id, activity_code, source, delta_points)
SELECT 
  s.user_id,
  s.activity_code,
  'MANUAL' as source,
  a.default_points as delta_points
FROM submissions s
JOIN activities a ON s.activity_code = a.code
LEFT JOIN points_ledger pl ON s.user_id = pl.user_id 
  AND s.activity_code = pl.activity_code
WHERE s.status = 'APPROVED'
  AND pl.id IS NULL
  AND a.default_points > 0;
```

##### Materialized View Corruption
```sql
-- Drop and recreate views
DROP MATERIALIZED VIEW IF EXISTS leaderboard_totals CASCADE;
-- Execute view creation SQL from migration

-- Refresh after recreation
SELECT refresh_all_analytics();
```

## Monitoring & Alerting

### Health Checks

#### System Health Endpoint
```typescript
// /api/health/database
export async function GET() {
  try {
    // Test basic connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Check materialized view freshness
    const views = await prisma.$queryRaw`
      SELECT matviewname, pg_size_pretty(pg_total_relation_size(matviewname)) as size
      FROM pg_matviews WHERE schemaname = 'public'
    `;
    
    // Check recent activity
    const recentSubmissions = await prisma.submission.count({
      where: { created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    });
    
    return { status: 'healthy', views, recentSubmissions };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}
```

#### Performance Metrics
```sql
-- Database size monitoring
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as db_size,
  pg_size_pretty(sum(pg_total_relation_size(tablename))) as table_size
FROM pg_tables WHERE schemaname = 'public';

-- Activity trends (last 24 hours)
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as submissions,
  COUNT(*) FILTER (WHERE status = 'APPROVED') as approvals
FROM submissions
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

### Alerting Thresholds

#### Critical Alerts
- **Database connection failures** (immediate)
- **Migration failures** (immediate)
- **Materialized view refresh failures** (5 minutes)
- **Amplify quota trigger errors** (immediate)
- **Foreign key constraint violations** (immediate)

#### Warning Alerts
- **Slow query duration > 10 seconds** (1 minute)
- **Connection pool > 80% utilized** (5 minutes)
- **Review queue > 50 pending** (1 hour)
- **Daily submissions drop > 50%** (daily)
- **Materialized view age > 30 minutes** (hourly)

#### Monitoring Queries
```sql
-- Review queue size
SELECT 
  activity_code,
  COUNT(*) as pending_count,
  MIN(created_at) as oldest_pending
FROM submissions 
WHERE status = 'PENDING'
GROUP BY activity_code;

-- Point distribution anomalies
SELECT 
  date_trunc('day', created_at) as day,
  SUM(delta_points) as daily_points,
  COUNT(*) as entries,
  AVG(delta_points) as avg_points
FROM points_ledger
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY day
ORDER BY day;
```

## CI/CD Integration

### Migration Deployment

#### Pre-deployment Checks
```bash
#!/bin/bash
# scripts/pre-deploy-db.sh

echo "🔍 Pre-deployment database checks..."

# Check migration status
pnpm db:migrate:status

# Validate schema
pnpm type-check

# Test connection
pnpm db:check

# Run health checks
curl -f "$STAGING_URL/api/health/database" || exit 1

echo "✅ Pre-deployment checks passed"
```

#### Post-deployment Tasks
```bash
#!/bin/bash
# scripts/post-deploy-db.sh

echo "🚀 Post-deployment database tasks..."

# Apply migrations
pnpm db:migrate

# Refresh materialized views
psql $DATABASE_URL -c "SELECT refresh_all_analytics();"

# Verify deployment
curl -f "$PRODUCTION_URL/api/health/database" || exit 1

# Warm up cache
curl -s "$PRODUCTION_URL/leaderboard" > /dev/null

echo "✅ Post-deployment tasks completed"
```

### Environment Promotion

#### Staging to Production
```bash
# 1. Backup production
pg_dump $PROD_DATABASE_URL > prod_backup_$(date +%Y%m%d).sql

# 2. Test migration on staging
pnpm db:migrate:dev --schema=schema.prisma

# 3. Apply to production
export DATABASE_URL=$PROD_DATABASE_URL
pnpm db:migrate

# 4. Refresh analytics
psql $PROD_DATABASE_URL -c "SELECT refresh_all_analytics();"

# 5. Verify deployment
node scripts/verify-production.js
```

## Emergency Procedures

### Database Connectivity Issues

#### Immediate Response
1. **Check Supabase Status**: https://status.supabase.com/
2. **Verify Environment Variables**: Ensure DATABASE_URL is correct
3. **Test Direct Connection**: 
   ```bash
   psql $DATABASE_URL -c "SELECT version();"
   ```
4. **Check Connection Pool**: Monitor active connections
5. **Restart Application**: Force connection pool reset

#### Connection Pool Exhaustion
```sql
-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' 
  AND now() - state_change > interval '1 hour';

-- Emergency connection limit increase (temporary)
ALTER SYSTEM SET max_connections = 200;
SELECT pg_reload_conf();
```

### Data Corruption Recovery

#### Materialized View Issues
```sql
-- Emergency view refresh
DROP MATERIALIZED VIEW leaderboard_totals CASCADE;
-- Recreate from migration SQL
SELECT refresh_all_analytics();
```

#### Point Ledger Corruption
```sql
-- Backup corrupted data
CREATE TABLE points_ledger_backup AS 
SELECT * FROM points_ledger WHERE created_at >= CURRENT_DATE;

-- Restore from approved submissions
-- (Execute restoration SQL based on approved submissions)
```

### Performance Crisis

#### Immediate Actions
1. **Identify Slow Queries**: Check pg_stat_activity
2. **Kill Long Runners**: Use pg_terminate_backend
3. **Disable Non-Critical Features**: Comment out heavy queries
4. **Scale Database**: Upgrade Supabase plan temporarily
5. **Enable Read Replicas**: Route analytics to read-only replica

#### Query Optimization Emergency
```sql
-- Emergency index creation
CREATE INDEX CONCURRENTLY idx_emergency_submissions_created 
ON submissions(created_at) WHERE status = 'PENDING';

-- Temporary query simplification
-- Replace complex analytics queries with basic counts
```

### Data Loss Recovery

#### Recent Data Recovery (< 24 hours)
1. **Point-in-Time Restore**: Use Supabase backup
2. **Manual Entry**: Recreate recent submissions from logs
3. **User Communication**: Notify affected users
4. **Audit Trail**: Document recovery process

#### Historical Data Recovery
1. **External Backups**: Check manual backup retention
2. **Kajabi Webhook Replay**: Re-process webhook events
3. **CSV Import**: Restore from exported data
4. **User Re-submission**: Allow users to resubmit if needed

### Contact Information

- **Database Team**: db-team@mereka.org
- **On-Call Engineer**: +62-xxx-xxxx-xxxx
- **Supabase Support**: support@supabase.com
- **Emergency Escalation**: CTO@mereka.org

### Recovery Time Objectives (RTO)

- **Minor Issues**: < 30 minutes
- **Major Outages**: < 2 hours
- **Data Recovery**: < 4 hours
- **Full System Rebuild**: < 24 hours

### Recovery Point Objectives (RPO)

- **Point Data**: < 1 hour
- **Submissions**: < 4 hours
- **User Data**: < 24 hours
- **Analytics**: Acceptable to rebuild from source