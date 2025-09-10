-- Filter leaderboard views to show only EDUCATOR user_type, not STUDENT
-- This ensures students don't appear on the public leaderboard

-- Drop existing materialized views to recreate with user type filter
DROP MATERIALIZED VIEW IF EXISTS leaderboard_totals CASCADE;
DROP MATERIALIZED VIEW IF EXISTS leaderboard_30d CASCADE;

-- Recreate all-time leaderboard totals with EDUCATOR filter
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
WHERE u.role = 'PARTICIPANT' AND u.user_type = 'EDUCATOR'
GROUP BY u.id, u.handle, u.name, u.avatar_url, u.school, u.cohort
HAVING COALESCE(SUM(pl.delta_points), 0) > 0
ORDER BY total_points DESC, last_activity_at DESC;

-- Create index on the materialized view for faster queries
CREATE INDEX idx_leaderboard_totals_points ON leaderboard_totals(total_points DESC);
CREATE INDEX idx_leaderboard_totals_handle ON leaderboard_totals(handle);

-- Recreate 30-day rolling leaderboard with EDUCATOR filter
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
WHERE u.role = 'PARTICIPANT' AND u.user_type = 'EDUCATOR'
GROUP BY u.id, u.handle, u.name, u.avatar_url, u.school, u.cohort
HAVING COALESCE(SUM(pl.delta_points), 0) > 0
ORDER BY total_points DESC, last_activity_at DESC;

-- Create index on the 30-day materialized view
CREATE INDEX idx_leaderboard_30d_points ON leaderboard_30d(total_points DESC);
CREATE INDEX idx_leaderboard_30d_handle ON leaderboard_30d(handle);