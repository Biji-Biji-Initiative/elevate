-- Harmonize materialized views to match Prisma schema definitions
-- This replaces the existing views with the canonical Prisma versions

-- Drop existing materialized views to recreate with canonical structure
DROP MATERIALIZED VIEW IF EXISTS leaderboard_totals CASCADE;
DROP MATERIALIZED VIEW IF EXISTS leaderboard_30d CASCADE;
DROP MATERIALIZED VIEW IF EXISTS metric_counts CASCADE;

-- Recreate all-time leaderboard totals (matches Prisma 002_views.sql)
CREATE MATERIALIZED VIEW leaderboard_totals AS
SELECT 
    u.id as user_id,
    u.handle,
    u.name,
    u.avatar_url,
    u.school,
    u.cohort,
    COALESCE(SUM(pl.delta_points), 0) as total_points,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'APPROVED' AND s.visibility = 'PUBLIC') as public_submissions,
    MAX(pl.created_at) as last_activity_at
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id
LEFT JOIN submissions s ON u.id = s.user_id
WHERE u.role = 'PARTICIPANT'
GROUP BY u.id, u.handle, u.name, u.avatar_url, u.school, u.cohort
HAVING COALESCE(SUM(pl.delta_points), 0) > 0
ORDER BY total_points DESC, last_activity_at DESC;

-- Create index on the materialized view for faster queries
CREATE INDEX idx_leaderboard_totals_points ON leaderboard_totals(total_points DESC);
CREATE INDEX idx_leaderboard_totals_handle ON leaderboard_totals(handle);

-- Recreate 30-day rolling leaderboard (matches Prisma 002_views.sql)
CREATE MATERIALIZED VIEW leaderboard_30d AS
SELECT 
    u.id as user_id,
    u.handle,
    u.name,
    u.avatar_url,
    u.school,
    u.cohort,
    COALESCE(SUM(pl.delta_points), 0) as total_points,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'APPROVED' AND s.visibility = 'PUBLIC') as public_submissions,
    MAX(pl.created_at) as last_activity_at
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id 
    AND pl.created_at >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN submissions s ON u.id = s.user_id 
    AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'
    AND s.status = 'APPROVED' 
    AND s.visibility = 'PUBLIC'
WHERE u.role = 'PARTICIPANT'
GROUP BY u.id, u.handle, u.name, u.avatar_url, u.school, u.cohort
HAVING COALESCE(SUM(pl.delta_points), 0) > 0
ORDER BY total_points DESC, last_activity_at DESC;

-- Create index on the 30-day materialized view
CREATE INDEX idx_leaderboard_30d_points ON leaderboard_30d(total_points DESC);
CREATE INDEX idx_leaderboard_30d_handle ON leaderboard_30d(handle);

-- Recreate activity metrics (matches Prisma 002_views.sql as activity_metrics)
CREATE MATERIALIZED VIEW activity_metrics AS
SELECT 
    a.code,
    a.name,
    COUNT(s.id) as total_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'PENDING') as pending_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'APPROVED') as approved_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'REJECTED') as rejected_submissions,
    COUNT(s.id) FILTER (WHERE s.visibility = 'PUBLIC' AND s.status = 'APPROVED') as public_submissions,
    COALESCE(SUM(pl.delta_points), 0) as total_points_awarded,
    COALESCE(AVG(pl.delta_points), 0) as avg_points_per_submission
FROM activities a
LEFT JOIN submissions s ON a.code = s.activity_code
LEFT JOIN points_ledger pl ON a.code = pl.activity_code AND s.user_id = pl.user_id
GROUP BY a.code, a.name
ORDER BY a.code;

-- Create index on activity metrics
CREATE INDEX idx_activity_metrics_code ON activity_metrics(code);

-- Recreate refresh function to match Prisma version
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_totals;
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_30d;
    REFRESH MATERIALIZED VIEW CONCURRENTLY activity_metrics;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the harmonization
COMMENT ON MATERIALIZED VIEW leaderboard_totals IS 'All-time leaderboard - harmonized with Prisma schema';
COMMENT ON MATERIALIZED VIEW leaderboard_30d IS '30-day rolling leaderboard - harmonized with Prisma schema';
COMMENT ON MATERIALIZED VIEW activity_metrics IS 'Activity submission metrics - harmonized with Prisma schema';