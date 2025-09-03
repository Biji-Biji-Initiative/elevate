-- Rollback Script for Schema Consolidation
-- Use this to revert changes if needed (run in reverse order)

-- Step 6: Remove harmonized materialized views
DROP MATERIALIZED VIEW IF EXISTS activity_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS leaderboard_30d CASCADE;  
DROP MATERIALIZED VIEW IF EXISTS leaderboard_totals CASCADE;

-- Step 5: Remove submission_attachments table
DROP TABLE IF EXISTS submission_attachments CASCADE;

-- Step 4: Remove kajabi_contact_id column
ALTER TABLE users DROP COLUMN IF EXISTS kajabi_contact_id;

-- Step 3: Remove amplify quota trigger and function
DROP TRIGGER IF EXISTS trg_check_amplify_quota ON submissions;
DROP FUNCTION IF EXISTS check_amplify_quota();

-- Step 2: Remove unique LEARN submission constraint
DROP INDEX IF EXISTS uniq_learn_active_submission;

-- Step 1: Remove additional indexes
DROP INDEX IF EXISTS idx_users_kajabi_contact_id;
DROP INDEX IF EXISTS uniq_points_external_event;

-- Recreate original Supabase materialized views (simplified versions)
CREATE MATERIALIZED VIEW leaderboard_totals AS
SELECT 
    u.id,
    u.handle,
    u.name,
    u.avatar_url,
    u.school,
    COALESCE(SUM(pl.delta_points), 0) as total_points,
    COUNT(DISTINCT s.activity_code) FILTER (WHERE s.status = 'APPROVED') as activities_completed,
    MAX(s.updated_at) FILTER (WHERE s.status = 'APPROVED') as last_activity_date
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id
LEFT JOIN submissions s ON u.id = s.user_id AND s.status = 'APPROVED' AND s.visibility = 'PUBLIC'
WHERE u.role = 'PARTICIPANT'
GROUP BY u.id, u.handle, u.name, u.avatar_url, u.school
ORDER BY total_points DESC;

CREATE INDEX leaderboard_totals_points_idx ON leaderboard_totals(total_points DESC);

CREATE MATERIALIZED VIEW leaderboard_30d AS
SELECT 
    u.id,
    u.handle,
    u.name,
    u.avatar_url,
    u.school,
    COALESCE(SUM(pl.delta_points), 0) as total_points,
    COUNT(DISTINCT s.activity_code) FILTER (WHERE s.status = 'APPROVED') as activities_completed,
    MAX(s.updated_at) FILTER (WHERE s.status = 'APPROVED') as last_activity_date
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id 
    AND pl.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
LEFT JOIN submissions s ON u.id = s.user_id 
    AND s.status = 'APPROVED' 
    AND s.visibility = 'PUBLIC'
    AND s.updated_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
WHERE u.role = 'PARTICIPANT'
GROUP BY u.id, u.handle, u.name, u.avatar_url, u.school
ORDER BY total_points DESC;

CREATE INDEX leaderboard_30d_points_idx ON leaderboard_30d(total_points DESC);

CREATE MATERIALIZED VIEW metric_counts AS
SELECT 
    a.code as activity_code,
    a.name as activity_name,
    COUNT(*) FILTER (WHERE s.status = 'PENDING') as pending_count,
    COUNT(*) FILTER (WHERE s.status = 'APPROVED') as approved_count,
    COUNT(*) FILTER (WHERE s.status = 'REJECTED') as rejected_count,
    COUNT(*) as total_submissions,
    COUNT(DISTINCT s.user_id) as unique_participants
FROM activities a
LEFT JOIN submissions s ON a.code = s.activity_code
GROUP BY a.code, a.name
ORDER BY a.code;

-- Recreate original refresh functions
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW leaderboard_totals;
    REFRESH MATERIALIZED VIEW leaderboard_30d;
    REFRESH MATERIALIZED VIEW metric_counts;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_leaderboards_concurrent()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_totals;
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_30d;
    REFRESH MATERIALIZED VIEW CONCURRENTLY metric_counts;
END;
$$ LANGUAGE plpgsql;

SELECT 'Schema consolidation rollback completed' as status;