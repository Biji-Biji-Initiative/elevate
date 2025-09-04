-- Migration: Fix Analytics & Leaderboard Correctness
-- Created: 2025-09-04
-- Purpose: Fix leaderboard views, add missing analytics, handle negative points, optimize performance

-- Drop existing views to recreate with fixes
DROP MATERIALIZED VIEW IF EXISTS leaderboard_30d CASCADE;
DROP MATERIALIZED VIEW IF EXISTS leaderboard_totals CASCADE;
DROP MATERIALIZED VIEW IF EXISTS activity_metrics CASCADE;

-- =============================================================================
-- FIXED LEADERBOARD VIEWS
-- =============================================================================

-- Create improved all-time leaderboard totals
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
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'APPROVED') as total_approved_submissions,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'PENDING') as pending_submissions,
    MAX(GREATEST(pl.created_at, s.updated_at)) as last_activity_at,
    MIN(pl.created_at) as first_points_at
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id
LEFT JOIN submissions s ON u.id = s.user_id
WHERE u.role = 'PARTICIPANT'
GROUP BY u.id, u.handle, u.name, u.avatar_url, u.school, u.cohort
-- Include users with submissions even if no points yet (pending submissions)
HAVING COALESCE(SUM(pl.delta_points), 0) > 0 OR COUNT(s.id) > 0
ORDER BY total_points DESC, last_activity_at DESC;

-- Create FIXED 30-day rolling leaderboard (properly coordinated date filtering)
CREATE MATERIALIZED VIEW leaderboard_30d AS
WITH recent_activity AS (
    -- Get all users with activity in the last 30 days
    SELECT DISTINCT user_id 
    FROM (
        SELECT user_id FROM points_ledger WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        UNION
        SELECT user_id FROM submissions WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    ) recent_users
)
SELECT 
    u.id as user_id,
    u.handle,
    u.name,
    u.avatar_url,
    u.school,
    u.cohort,
    -- Points from last 30 days only
    COALESCE(SUM(pl.delta_points), 0) as total_points,
    -- Public submissions from last 30 days only
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'APPROVED' AND s.visibility = 'PUBLIC') as public_submissions,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'APPROVED') as total_approved_submissions,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'PENDING') as pending_submissions,
    MAX(GREATEST(pl.created_at, s.updated_at)) as last_activity_at
FROM users u
INNER JOIN recent_activity ra ON u.id = ra.user_id
-- Only join points/submissions from the last 30 days
LEFT JOIN points_ledger pl ON u.id = pl.user_id 
    AND pl.created_at >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN submissions s ON u.id = s.user_id 
    AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'
WHERE u.role = 'PARTICIPANT'
GROUP BY u.id, u.handle, u.name, u.avatar_url, u.school, u.cohort
-- Include users with recent activity even if no points in the period
HAVING COALESCE(SUM(pl.delta_points), 0) > 0 OR COUNT(s.id) > 0
ORDER BY total_points DESC, last_activity_at DESC;

-- =============================================================================
-- FIXED ACTIVITY METRICS VIEW
-- =============================================================================

CREATE MATERIALIZED VIEW activity_metrics AS
SELECT 
    a.code,
    a.name,
    a.default_points,
    -- Submission counts
    COUNT(s.id) as total_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'PENDING') as pending_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'APPROVED') as approved_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'REJECTED') as rejected_submissions,
    COUNT(s.id) FILTER (WHERE s.visibility = 'PUBLIC' AND s.status = 'APPROVED') as public_submissions,
    -- Points metrics (from points_ledger, not submissions)
    COALESCE(SUM(pl.delta_points), 0) as total_points_awarded,
    COALESCE(SUM(pl.delta_points) FILTER (WHERE pl.delta_points > 0), 0) as positive_points_awarded,
    COALESCE(SUM(pl.delta_points) FILTER (WHERE pl.delta_points < 0), 0) as negative_points_awarded,
    COALESCE(AVG(pl.delta_points), 0) as avg_points_per_entry,
    -- Activity timing
    MIN(s.created_at) as first_submission_at,
    MAX(s.created_at) as latest_submission_at,
    -- Distinct user engagement
    COUNT(DISTINCT s.user_id) as unique_participants,
    COUNT(DISTINCT s.user_id) FILTER (WHERE s.status = 'APPROVED') as unique_approved_participants
FROM activities a
LEFT JOIN submissions s ON a.code = s.activity_code
LEFT JOIN points_ledger pl ON a.code = pl.activity_code
GROUP BY a.code, a.name, a.default_points
ORDER BY a.code;

-- =============================================================================
-- NEW COHORT AND SCHOOL ANALYTICS
-- =============================================================================

-- Create cohort-level metrics materialized view
CREATE MATERIALIZED VIEW cohort_metrics AS
SELECT 
    COALESCE(u.cohort, 'Unassigned') as cohort,
    -- Participation counts
    COUNT(DISTINCT u.id) as total_participants,
    COUNT(DISTINCT u.id) FILTER (WHERE pl.user_id IS NOT NULL) as participants_with_points,
    COUNT(DISTINCT u.id) FILTER (WHERE s.user_id IS NOT NULL) as participants_with_submissions,
    -- Points aggregation
    COALESCE(SUM(pl.delta_points), 0) as total_points,
    COALESCE(AVG(user_totals.user_points), 0) as avg_points_per_participant,
    COALESCE(MAX(user_totals.user_points), 0) as max_points_in_cohort,
    -- Submission metrics
    COUNT(s.id) as total_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'APPROVED') as approved_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'PENDING') as pending_submissions,
    COUNT(s.id) FILTER (WHERE s.visibility = 'PUBLIC') as public_submissions,
    -- Activity timeline
    MIN(s.created_at) as first_activity_at,
    MAX(s.created_at) as latest_activity_at
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id
LEFT JOIN submissions s ON u.id = s.user_id
LEFT JOIN (
    -- Pre-calculate user point totals for avg calculation
    SELECT user_id, SUM(delta_points) as user_points
    FROM points_ledger
    GROUP BY user_id
) user_totals ON u.id = user_totals.user_id
WHERE u.role = 'PARTICIPANT'
GROUP BY u.cohort
ORDER BY total_points DESC;

-- Create school-level metrics materialized view
CREATE MATERIALIZED VIEW school_metrics AS
SELECT 
    COALESCE(u.school, 'Unassigned') as school,
    -- Participation counts
    COUNT(DISTINCT u.id) as total_participants,
    COUNT(DISTINCT u.id) FILTER (WHERE pl.user_id IS NOT NULL) as participants_with_points,
    COUNT(DISTINCT u.id) FILTER (WHERE s.user_id IS NOT NULL) as participants_with_submissions,
    -- Points aggregation
    COALESCE(SUM(pl.delta_points), 0) as total_points,
    COALESCE(AVG(user_totals.user_points), 0) as avg_points_per_participant,
    COALESCE(MAX(user_totals.user_points), 0) as max_points_in_school,
    -- Submission metrics
    COUNT(s.id) as total_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'APPROVED') as approved_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'PENDING') as pending_submissions,
    COUNT(s.id) FILTER (WHERE s.visibility = 'PUBLIC') as public_submissions,
    -- Cohort diversity
    COUNT(DISTINCT u.cohort) FILTER (WHERE u.cohort IS NOT NULL) as cohort_count,
    -- Activity timeline
    MIN(s.created_at) as first_activity_at,
    MAX(s.created_at) as latest_activity_at
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id
LEFT JOIN submissions s ON u.id = s.user_id
LEFT JOIN (
    -- Pre-calculate user point totals for avg calculation
    SELECT user_id, SUM(delta_points) as user_points
    FROM points_ledger
    GROUP BY user_id
) user_totals ON u.id = user_totals.user_id
WHERE u.role = 'PARTICIPANT'
GROUP BY u.school
ORDER BY total_points DESC;

-- =============================================================================
-- TIME-SERIES ANALYTICS FOR TREND ANALYSIS
-- =============================================================================

-- Create daily time-series metrics view
CREATE MATERIALIZED VIEW time_series_metrics AS
WITH date_series AS (
    -- Generate date series for the last 90 days
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '90 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    )::date as date
),
daily_points AS (
    SELECT 
        pl.created_at::date as date,
        pl.activity_code,
        SUM(pl.delta_points) as points_awarded,
        COUNT(*) as point_entries,
        COUNT(DISTINCT pl.user_id) as unique_users
    FROM points_ledger pl
    WHERE pl.created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY pl.created_at::date, pl.activity_code
),
daily_submissions AS (
    SELECT 
        s.created_at::date as date,
        s.activity_code,
        COUNT(*) as submissions_created,
        COUNT(*) FILTER (WHERE s.status = 'APPROVED') as submissions_approved,
        COUNT(*) FILTER (WHERE s.status = 'REJECTED') as submissions_rejected,
        COUNT(DISTINCT s.user_id) as unique_submitters
    FROM submissions s
    WHERE s.created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY s.created_at::date, s.activity_code
)
SELECT 
    ds.date,
    a.code as activity_code,
    a.name as activity_name,
    -- Points metrics
    COALESCE(dp.points_awarded, 0) as points_awarded,
    COALESCE(dp.point_entries, 0) as point_entries,
    COALESCE(dp.unique_users, 0) as unique_point_users,
    -- Submission metrics
    COALESCE(dsub.submissions_created, 0) as submissions_created,
    COALESCE(dsub.submissions_approved, 0) as submissions_approved,
    COALESCE(dsub.submissions_rejected, 0) as submissions_rejected,
    COALESCE(dsub.unique_submitters, 0) as unique_submitters,
    -- Running totals (cumulative)
    SUM(COALESCE(dp.points_awarded, 0)) OVER (
        PARTITION BY a.code 
        ORDER BY ds.date 
        ROWS UNBOUNDED PRECEDING
    ) as cumulative_points,
    SUM(COALESCE(dsub.submissions_created, 0)) OVER (
        PARTITION BY a.code 
        ORDER BY ds.date 
        ROWS UNBOUNDED PRECEDING
    ) as cumulative_submissions
FROM date_series ds
CROSS JOIN activities a
LEFT JOIN daily_points dp ON ds.date = dp.date AND a.code = dp.activity_code
LEFT JOIN daily_submissions dsub ON ds.date = dsub.date AND a.code = dsub.activity_code
ORDER BY ds.date DESC, a.code;

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- Indexes for leaderboard_totals
CREATE INDEX idx_leaderboard_totals_points ON leaderboard_totals(total_points DESC);
CREATE INDEX idx_leaderboard_totals_handle ON leaderboard_totals(handle);
CREATE INDEX idx_leaderboard_totals_cohort ON leaderboard_totals(cohort) WHERE cohort IS NOT NULL;
CREATE INDEX idx_leaderboard_totals_school ON leaderboard_totals(school) WHERE school IS NOT NULL;

-- Indexes for leaderboard_30d
CREATE INDEX idx_leaderboard_30d_points ON leaderboard_30d(total_points DESC);
CREATE INDEX idx_leaderboard_30d_handle ON leaderboard_30d(handle);
CREATE INDEX idx_leaderboard_30d_activity ON leaderboard_30d(last_activity_at DESC);

-- Indexes for activity_metrics
CREATE INDEX idx_activity_metrics_code ON activity_metrics(code);

-- Indexes for cohort_metrics
CREATE INDEX idx_cohort_metrics_cohort ON cohort_metrics(cohort);
CREATE INDEX idx_cohort_metrics_points ON cohort_metrics(total_points DESC);

-- Indexes for school_metrics
CREATE INDEX idx_school_metrics_school ON school_metrics(school);
CREATE INDEX idx_school_metrics_points ON school_metrics(total_points DESC);

-- Indexes for time_series_metrics
CREATE INDEX idx_time_series_date_activity ON time_series_metrics(date, activity_code);
CREATE INDEX idx_time_series_activity_date ON time_series_metrics(activity_code, date DESC);

-- Optimize base table queries with additional indexes
CREATE INDEX IF NOT EXISTS idx_points_ledger_created_at ON points_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_status_visibility ON submissions(status, visibility) WHERE status = 'APPROVED';
CREATE INDEX IF NOT EXISTS idx_users_role_cohort ON users(role, cohort) WHERE role = 'PARTICIPANT';
CREATE INDEX IF NOT EXISTS idx_users_role_school ON users(role, school) WHERE role = 'PARTICIPANT';

-- =============================================================================
-- ANALYTICS HELPER FUNCTIONS
-- =============================================================================

-- Enhanced refresh function that handles all materialized views
CREATE OR REPLACE FUNCTION refresh_all_analytics()
RETURNS void AS $$
BEGIN
    -- Refresh in dependency order
    REFRESH MATERIALIZED VIEW CONCURRENTLY activity_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_totals;
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_30d;
    REFRESH MATERIALIZED VIEW CONCURRENTLY cohort_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY school_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY time_series_metrics;
END;
$$ LANGUAGE plpgsql;

-- Backward compatibility alias
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
BEGIN
    -- Call the new comprehensive function
    PERFORM refresh_all_analytics();
END;
$$ LANGUAGE plpgsql;

-- Function to get user point summary including negative points handling
CREATE OR REPLACE FUNCTION get_user_point_summary(target_user_id TEXT)
RETURNS TABLE(
    user_id TEXT,
    total_points BIGINT,
    positive_points BIGINT,
    negative_points BIGINT,
    point_entries BIGINT,
    activities_with_points BIGINT,
    first_points_at TIMESTAMP,
    latest_points_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pl.user_id,
        SUM(pl.delta_points)::BIGINT as total_points,
        SUM(pl.delta_points) FILTER (WHERE pl.delta_points > 0)::BIGINT as positive_points,
        SUM(pl.delta_points) FILTER (WHERE pl.delta_points < 0)::BIGINT as negative_points,
        COUNT(*)::BIGINT as point_entries,
        COUNT(DISTINCT pl.activity_code)::BIGINT as activities_with_points,
        MIN(pl.created_at) as first_points_at,
        MAX(pl.created_at) as latest_points_at
    FROM points_ledger pl
    WHERE pl.user_id = target_user_id
    GROUP BY pl.user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get activity leaderboard for a specific activity
CREATE OR REPLACE FUNCTION get_activity_leaderboard(target_activity_code TEXT, limit_count INTEGER DEFAULT 20)
RETURNS TABLE(
    user_id TEXT,
    handle TEXT,
    name TEXT,
    avatar_url TEXT,
    total_points BIGINT,
    submission_count BIGINT,
    latest_submission_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.handle,
        u.name,
        u.avatar_url,
        COALESCE(SUM(pl.delta_points), 0)::BIGINT as total_points,
        COUNT(DISTINCT s.id)::BIGINT as submission_count,
        MAX(s.created_at) as latest_submission_at
    FROM users u
    LEFT JOIN points_ledger pl ON u.id = pl.user_id AND pl.activity_code = target_activity_code
    LEFT JOIN submissions s ON u.id = s.user_id AND s.activity_code = target_activity_code
    WHERE u.role = 'PARTICIPANT'
    GROUP BY u.id, u.handle, u.name, u.avatar_url
    HAVING COALESCE(SUM(pl.delta_points), 0) > 0 OR COUNT(s.id) > 0
    ORDER BY total_points DESC, latest_submission_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function for cohort comparison analytics
CREATE OR REPLACE FUNCTION get_cohort_comparison()
RETURNS TABLE(
    cohort TEXT,
    participant_count BIGINT,
    avg_points_per_user NUMERIC,
    total_points BIGINT,
    completion_rate NUMERIC,
    top_user_points BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(cm.cohort, 'Unassigned') as cohort,
        cm.total_participants as participant_count,
        ROUND(cm.avg_points_per_participant, 2) as avg_points_per_user,
        cm.total_points,
        CASE 
            WHEN cm.total_participants > 0 
            THEN ROUND((cm.participants_with_points::NUMERIC / cm.total_participants) * 100, 2)
            ELSE 0 
        END as completion_rate,
        cm.max_points_in_cohort as top_user_points
    FROM cohort_metrics cm
    ORDER BY cm.total_points DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS AND DOCUMENTATION
-- =============================================================================

-- Add comments to explain the business logic of each view

COMMENT ON MATERIALIZED VIEW leaderboard_totals IS 
'All-time leaderboard showing participant rankings based on total points earned across all activities. Includes both public and private submission counts for admin visibility.';

COMMENT ON MATERIALIZED VIEW leaderboard_30d IS 
'Rolling 30-day leaderboard showing recent participant activity and points. Uses proper date filtering to ensure both points and submissions are from the same time period.';

COMMENT ON MATERIALIZED VIEW activity_metrics IS 
'Comprehensive metrics for each LEAPS activity including submission counts, approval rates, and point distribution. Handles positive and negative points separately for audit purposes.';

COMMENT ON MATERIALIZED VIEW cohort_metrics IS 
'Cohort-level aggregations showing participation rates, average performance, and engagement metrics. Used for program evaluation and cohort comparison.';

COMMENT ON MATERIALIZED VIEW school_metrics IS 
'School-level aggregations showing institutional participation and performance. Supports multi-cohort schools and geographic analysis.';

COMMENT ON MATERIALIZED VIEW time_series_metrics IS 
'Daily time-series data for the last 90 days showing trends in submissions, approvals, and points awarded. Includes cumulative totals for growth tracking.';

COMMENT ON FUNCTION refresh_all_analytics() IS 
'Refreshes all analytics materialized views in the correct dependency order. Should be called after bulk data changes or on a scheduled basis.';

COMMENT ON FUNCTION get_user_point_summary(TEXT) IS 
'Returns detailed point breakdown for a specific user including positive/negative point handling and activity engagement metrics.';

COMMENT ON FUNCTION get_activity_leaderboard(TEXT, INTEGER) IS 
'Returns top performers for a specific LEAPS activity with submission counts and timing. Useful for activity-specific recognition.';

COMMENT ON FUNCTION get_cohort_comparison() IS 
'Returns cohort comparison metrics including completion rates and performance benchmarks. Used for program evaluation and cohort management.';