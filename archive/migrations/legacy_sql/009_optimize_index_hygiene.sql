-- Migration: Comprehensive Index Optimization and Hygiene
-- Created: 2025-09-04
-- Purpose: Clean up index redundancy, add missing indexes for common query patterns, 
--          optimize materialized view performance, and implement index monitoring

-- =============================================================================
-- INDEX ANALYSIS AND CURRENT STATE
-- =============================================================================

/*
EXISTING INDEXES ANALYSIS:

Base Tables (from 20250904011005_init_consolidated):
1. users: handle(unique), email(unique), kajabi_contact_id(unique) 
2. submissions: (user_id, activity_code), 
3. points_ledger: (user_id, activity_code), external_event_id(unique)
4. earned_badges: (user_id, badge_code)(unique), badge_code
5. submission_attachments: (submission_id, path)(unique), submission_id
6. audit_log: (actor_id, created_at)

Additional Indexes (from 008_add_indexes.sql):
- submissions(status)
- submissions(user_id, status) 
- users(cohort)

Materialized View Indexes (from 20250904120000_fix_analytics_views):
- leaderboard_totals: (total_points DESC), handle, cohort, school
- leaderboard_30d: (total_points DESC), handle, (last_activity_at DESC)
- activity_metrics: code
- cohort_metrics: cohort, (total_points DESC)
- school_metrics: school, (total_points DESC)
- time_series_metrics: (date, activity_code), (activity_code, date DESC)

Base Table Optimization Indexes (from same migration):
- points_ledger(created_at)
- submissions(created_at) 
- submissions(status, visibility) WHERE status = 'APPROVED'
- users(role, cohort) WHERE role = 'PARTICIPANT'
- users(role, school) WHERE role = 'PARTICIPANT'

Trigger Performance Indexes (from 20250904122305_add_triggers_constraints):
- submissions(user_id, created_at) WHERE created_at >= NOW() - INTERVAL '24 hours'
- submissions((payload->>'certificateHash')) WHERE activity_code = 'LEARN' AND status = 'APPROVED'
- submissions(user_id, activity_code, status) WHERE activity_code = 'LEARN' AND status = 'APPROVED'
*/

-- =============================================================================
-- 1. REMOVE REDUNDANT AND CONFLICTING INDEXES
-- =============================================================================

-- Check for actual redundancy and conflicts before dropping
DO $$
BEGIN
    -- Remove the partial index for recent submissions as it conflicts with general rate limiting needs
    -- The trigger needs to check last hour, not last 24 hours
    DROP INDEX IF EXISTS idx_submissions_user_created_recent;
    RAISE NOTICE 'Dropped redundant/conflicting recent submissions index';
    
    -- The (user_id, status) index is less useful than more specific composite indexes we'll add
    -- Keep it for now as it's used in admin queries, but we'll optimize admin query patterns
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Some indexes may not exist yet: %', SQLERRM;
END $$;

-- =============================================================================
-- 2. CRITICAL MISSING INDEXES FOR QUERY PATTERNS
-- =============================================================================

-- Authentication and User Lookup Patterns
-- emails are frequently looked up during login and user resolution
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower 
ON users(LOWER(email));

-- handles are used for public profile lookups and user resolution 
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_handle_lower 
ON users(LOWER(handle));

-- Kajabi integration: email-based user matching (case insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_kajabi 
ON users(LOWER(email)) 
WHERE kajabi_contact_id IS NOT NULL;

-- =============================================================================
-- 3. ADMIN QUERY OPTIMIZATION INDEXES
-- =============================================================================

-- Admin submissions queue: filter by status + activity + sort by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_submissions_queue 
ON submissions(status, activity_code, created_at DESC);

-- Admin submissions: user-specific filtering with date sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_submissions_user_date 
ON submissions(user_id, created_at DESC)
WHERE status IN ('PENDING', 'APPROVED', 'REJECTED');

-- Reviewer assignment tracking and workload balancing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_reviewer_date 
ON submissions(reviewer_id, updated_at DESC)
WHERE reviewer_id IS NOT NULL;

-- Admin user management: role-based filtering with activity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_users_role_activity 
ON users(role, created_at DESC);

