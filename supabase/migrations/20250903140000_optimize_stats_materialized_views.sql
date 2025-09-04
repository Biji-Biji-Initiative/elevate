-- Optimize stats endpoint with comprehensive materialized views
-- This adds new views for platform-wide statistics to reduce query load

-- Drop existing views if they exist
DROP MATERIALIZED VIEW IF EXISTS platform_stats_overview CASCADE;
DROP MATERIALIZED VIEW IF EXISTS cohort_performance_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS monthly_growth_stats CASCADE;

-- Create platform overview stats materialized view
CREATE MATERIALIZED VIEW platform_stats_overview AS
SELECT 
    -- User statistics
    (SELECT COUNT(*) FROM users) as total_educators,
    (SELECT COUNT(*) FROM users WHERE role = 'PARTICIPANT') as total_participants,
    (SELECT COUNT(DISTINCT user_id) FROM submissions) as active_educators,
    
    -- Submission statistics  
    (SELECT COUNT(*) FROM submissions) as total_submissions,
    (SELECT COUNT(*) FROM submissions WHERE status = 'APPROVED') as approved_submissions,
    (SELECT COUNT(*) FROM submissions WHERE status = 'PENDING') as pending_submissions,
    (SELECT COUNT(*) FROM submissions WHERE status = 'REJECTED') as rejected_submissions,
    
    -- Points statistics
    COALESCE((SELECT SUM(delta_points) FROM points_ledger), 0) as total_points_awarded,
    COALESCE((SELECT AVG(delta_points) FROM points_ledger WHERE delta_points > 0), 0) as avg_points_per_award,
    
    -- Badge statistics
    (SELECT COUNT(*) FROM badges) as total_badges_available,
    (SELECT COUNT(*) FROM earned_badges) as total_badges_earned,
    (SELECT COUNT(DISTINCT user_id) FROM earned_badges) as users_with_badges,
    
    -- Activity breakdown
    jsonb_object_agg(
        activity_code, 
        jsonb_build_object(
            'total', submission_count,
            'approved', approved_count,
            'pending', pending_count,
            'rejected', rejected_count
        )
    ) as activity_breakdown,
    
    -- Calculated at refresh time
    NOW() as last_updated
FROM (
    SELECT 
        s.activity_code,
        COUNT(*) as submission_count,
        COUNT(*) FILTER (WHERE s.status = 'APPROVED') as approved_count,
        COUNT(*) FILTER (WHERE s.status = 'PENDING') as pending_count,
        COUNT(*) FILTER (WHERE s.status = 'REJECTED') as rejected_count
    FROM submissions s
    GROUP BY s.activity_code
) activity_stats;

-- Index for quick access
CREATE INDEX idx_platform_stats_last_updated ON platform_stats_overview(last_updated);

-- Create cohort performance stats materialized view  
CREATE MATERIALIZED VIEW cohort_performance_stats AS
SELECT 
    COALESCE(u.cohort, 'No Cohort') as cohort_name,
    COUNT(DISTINCT u.id) as user_count,
    COUNT(DISTINCT s.id) as total_submissions,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'APPROVED') as approved_submissions,
    COALESCE(AVG(user_points.total_points), 0) as avg_points_per_user,
    COALESCE(MAX(user_points.total_points), 0) as max_points_in_cohort,
    COUNT(DISTINCT eb.user_id) as users_with_badges,
    NOW() as last_updated
FROM users u
LEFT JOIN submissions s ON u.id = s.user_id
LEFT JOIN earned_badges eb ON u.id = eb.user_id
LEFT JOIN (
    SELECT 
        pl.user_id,
        SUM(pl.delta_points) as total_points
    FROM points_ledger pl
    GROUP BY pl.user_id
) user_points ON u.id = user_points.user_id
WHERE u.role = 'PARTICIPANT'
GROUP BY COALESCE(u.cohort, 'No Cohort')
ORDER BY avg_points_per_user DESC, user_count DESC;

-- Index for cohort performance
CREATE INDEX idx_cohort_performance_cohort ON cohort_performance_stats(cohort_name);
CREATE INDEX idx_cohort_performance_avg_points ON cohort_performance_stats(avg_points_per_user DESC);

-- Create monthly growth stats materialized view (last 12 months)
CREATE MATERIALIZED VIEW monthly_growth_stats AS
SELECT 
    DATE_TRUNC('month', month_date)::date as month,
    TO_CHAR(month_date, 'YYYY-MM') as month_key,
    TO_CHAR(month_date, 'Mon YYYY') as month_label,
    
    -- User registrations for this month
    COALESCE(new_users.count, 0) as new_educators,
    
    -- Submissions for this month
    COALESCE(submissions.count, 0) as new_submissions,
    COALESCE(submissions.approved_count, 0) as approved_submissions,
    
    -- Points awarded this month
    COALESCE(points.total_points, 0) as points_awarded,
    
    -- Cumulative totals up to this month
    SUM(COALESCE(new_users.count, 0)) OVER (ORDER BY month_date) as cumulative_educators,
    SUM(COALESCE(submissions.count, 0)) OVER (ORDER BY month_date) as cumulative_submissions,
    
    NOW() as last_updated
FROM (
    -- Generate series for last 12 months
    SELECT generate_series(
        DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months'),
        DATE_TRUNC('month', CURRENT_DATE),
        '1 month'::interval
    ) as month_date
) months
LEFT JOIN (
    SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as count
    FROM users 
    WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', created_at)
) new_users ON months.month_date = new_users.month
LEFT JOIN (
    SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_count
    FROM submissions
    WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', created_at)
) submissions ON months.month_date = submissions.month
LEFT JOIN (
    SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(delta_points) as total_points
    FROM points_ledger
    WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', created_at)
) points ON months.month_date = points.month
ORDER BY month_date;

-- Index for monthly growth stats
CREATE INDEX idx_monthly_growth_month ON monthly_growth_stats(month);
CREATE INDEX idx_monthly_growth_month_key ON monthly_growth_stats(month_key);

-- Update the refresh function to include new views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS TABLE(view_name text, refresh_duration_ms integer, success boolean) AS $$
DECLARE
    start_time timestamp;
    end_time timestamp;
    view_record record;
    duration_ms integer;
BEGIN
    -- List of all materialized views to refresh
    FOR view_record IN 
        SELECT unnest(ARRAY[
            'leaderboard_totals',
            'leaderboard_30d', 
            'activity_metrics',
            'platform_stats_overview',
            'cohort_performance_stats',
            'monthly_growth_stats'
        ]) as view_name
    LOOP
        start_time := clock_timestamp();
        
        BEGIN
            -- Refresh each view concurrently
            EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_record.view_name);
            
            end_time := clock_timestamp();
            duration_ms := EXTRACT(milliseconds FROM (end_time - start_time))::integer;
            
            view_name := view_record.view_name;
            refresh_duration_ms := duration_ms;
            success := true;
            
            RETURN NEXT;
            
        EXCEPTION WHEN OTHERS THEN
            end_time := clock_timestamp();
            duration_ms := EXTRACT(milliseconds FROM (end_time - start_time))::integer;
            
            view_name := view_record.view_name;
            refresh_duration_ms := duration_ms;
            success := false;
            
            RETURN NEXT;
        END;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Legacy function for backward compatibility
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
BEGIN
    PERFORM refresh_all_materialized_views();
END;
$$ LANGUAGE plpgsql;

-- Add triggers to automatically refresh views when key tables change
-- This provides near-real-time updates without manual refresh calls

CREATE OR REPLACE FUNCTION trigger_refresh_materialized_views()
RETURNS trigger AS $$
BEGIN
    -- Use pg_notify to signal that views need refresh
    -- This allows for batched/delayed refresh to avoid too frequent updates
    PERFORM pg_notify('materialized_views_refresh', 
        json_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'timestamp', EXTRACT(epoch FROM NOW())
        )::text
    );
    
    -- Return appropriate value based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on key tables (only if they don't already exist)
DO $$
BEGIN
    -- Trigger on points_ledger changes
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_refresh_on_points_change') THEN
        CREATE TRIGGER trigger_refresh_on_points_change
            AFTER INSERT OR UPDATE OR DELETE ON points_ledger
            FOR EACH ROW EXECUTE FUNCTION trigger_refresh_materialized_views();
    END IF;
    
    -- Trigger on submission status changes  
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_refresh_on_submission_change') THEN
        CREATE TRIGGER trigger_refresh_on_submission_change
            AFTER INSERT OR UPDATE OR DELETE ON submissions
            FOR EACH ROW EXECUTE FUNCTION trigger_refresh_materialized_views();
    END IF;
    
    -- Trigger on user changes
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_refresh_on_user_change') THEN
        CREATE TRIGGER trigger_refresh_on_user_change
            AFTER INSERT OR UPDATE OR DELETE ON users
            FOR EACH ROW EXECUTE FUNCTION trigger_refresh_materialized_views();
    END IF;
    
    -- Trigger on badge earning
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_refresh_on_badge_change') THEN
        CREATE TRIGGER trigger_refresh_on_badge_change
            AFTER INSERT OR DELETE ON earned_badges
            FOR EACH ROW EXECUTE FUNCTION trigger_refresh_materialized_views();
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON MATERIALIZED VIEW platform_stats_overview IS 'Comprehensive platform statistics - refreshed on data changes';
COMMENT ON MATERIALIZED VIEW cohort_performance_stats IS 'Cohort performance metrics - refreshed on data changes';  
COMMENT ON MATERIALIZED VIEW monthly_growth_stats IS 'Monthly growth trends (12 months) - refreshed daily';
COMMENT ON FUNCTION refresh_all_materialized_views() IS 'Refresh all materialized views with performance tracking';
COMMENT ON FUNCTION trigger_refresh_materialized_views() IS 'Trigger function to signal materialized view refresh needs';