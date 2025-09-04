-- Comprehensive indexing optimization for materialized views
-- This migration adds additional indexes to support common query patterns

-- Enhanced leaderboard_totals indexes
-- Note: Basic point indexes already exist from harmonization migration
DO $$ BEGIN
  -- Composite index for search queries (name, handle, school with points)
  CREATE INDEX IF NOT EXISTS idx_leaderboard_totals_search_points 
  ON leaderboard_totals (total_points DESC, name, handle, school);
  
  -- Index for cohort-based leaderboards
  CREATE INDEX IF NOT EXISTS idx_leaderboard_totals_cohort_points 
  ON leaderboard_totals (cohort, total_points DESC) WHERE cohort IS NOT NULL;
  
  -- Index for school-based leaderboards  
  CREATE INDEX IF NOT EXISTS idx_leaderboard_totals_school_points 
  ON leaderboard_totals (school, total_points DESC) WHERE school IS NOT NULL;
  
  -- Index for recent activity queries
  CREATE INDEX IF NOT EXISTS idx_leaderboard_totals_activity_points 
  ON leaderboard_totals (last_activity_at DESC, total_points DESC);
  
  -- Partial index for users with submissions (performance optimization)
  CREATE INDEX IF NOT EXISTS idx_leaderboard_totals_active_users 
  ON leaderboard_totals (total_points DESC, user_id) WHERE public_submissions > 0;
END $$;

-- Enhanced leaderboard_30d indexes  
DO $$ BEGIN
  -- Composite index for search queries (30-day period)
  CREATE INDEX IF NOT EXISTS idx_leaderboard_30d_search_points 
  ON leaderboard_30d (total_points DESC, name, handle, school);
  
  -- Index for cohort-based 30-day leaderboards
  CREATE INDEX IF NOT EXISTS idx_leaderboard_30d_cohort_points 
  ON leaderboard_30d (cohort, total_points DESC) WHERE cohort IS NOT NULL;
  
  -- Index for school-based 30-day leaderboards
  CREATE INDEX IF NOT EXISTS idx_leaderboard_30d_school_points 
  ON leaderboard_30d (school, total_points DESC) WHERE school IS NOT NULL;
  
  -- Index for recent activity in 30-day period
  CREATE INDEX IF NOT EXISTS idx_leaderboard_30d_activity_points 
  ON leaderboard_30d (last_activity_at DESC, total_points DESC);
  
  -- Partial index for active users in 30-day period
  CREATE INDEX IF NOT EXISTS idx_leaderboard_30d_active_users 
  ON leaderboard_30d (total_points DESC, user_id) WHERE public_submissions > 0;
END $$;

-- Enhanced activity_metrics indexes
DO $$ BEGIN
  -- Index for sorting by various metrics
  CREATE INDEX IF NOT EXISTS idx_activity_metrics_submissions 
  ON activity_metrics (total_submissions DESC);
  
  CREATE INDEX IF NOT EXISTS idx_activity_metrics_approvals 
  ON activity_metrics (approved_submissions DESC);
  
  CREATE INDEX IF NOT EXISTS idx_activity_metrics_points 
  ON activity_metrics (total_points_awarded DESC);
  
  CREATE INDEX IF NOT EXISTS idx_activity_metrics_avg_points 
  ON activity_metrics (avg_points_per_submission DESC);
  
  -- Composite index for filtering and sorting
  CREATE INDEX IF NOT EXISTS idx_activity_metrics_status_points 
  ON activity_metrics (approved_submissions DESC, total_points_awarded DESC);
END $$;

-- Text search indexes for better ILIKE performance on materialized views
DO $$ BEGIN
  -- Add GIN indexes for text search if supported
  -- Note: These may require additional extensions like pg_trgm
  
  -- Try to create trigram indexes for fuzzy text search (optional)
  -- This will fail gracefully if pg_trgm extension is not available
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_leaderboard_totals_name_trgm 
    ON leaderboard_totals USING GIN (name gin_trgm_ops);
    
    CREATE INDEX IF NOT EXISTS idx_leaderboard_totals_handle_trgm 
    ON leaderboard_totals USING GIN (handle gin_trgm_ops);
    
    CREATE INDEX IF NOT EXISTS idx_leaderboard_totals_school_trgm 
    ON leaderboard_totals USING GIN (school gin_trgm_ops);
    
    -- Same for 30-day leaderboard
    CREATE INDEX IF NOT EXISTS idx_leaderboard_30d_name_trgm 
    ON leaderboard_30d USING GIN (name gin_trgm_ops);
    
    CREATE INDEX IF NOT EXISTS idx_leaderboard_30d_handle_trgm 
    ON leaderboard_30d USING GIN (handle gin_trgm_ops);
    
    CREATE INDEX IF NOT EXISTS idx_leaderboard_30d_school_trgm 
    ON leaderboard_30d USING GIN (school gin_trgm_ops);
  EXCEPTION WHEN OTHERS THEN
    -- Log that trigram indexes were not created (pg_trgm not available)
    RAISE NOTICE 'Trigram indexes not created - pg_trgm extension may not be available';
  END;
END $$;

-- Add statistics collection targets for better query planning
DO $$ BEGIN
  -- Set higher statistics targets for frequently queried columns
  ALTER TABLE leaderboard_totals ALTER COLUMN total_points SET STATISTICS 1000;
  ALTER TABLE leaderboard_totals ALTER COLUMN name SET STATISTICS 1000;
  ALTER TABLE leaderboard_totals ALTER COLUMN handle SET STATISTICS 1000;
  ALTER TABLE leaderboard_totals ALTER COLUMN school SET STATISTICS 500;
  
  ALTER TABLE leaderboard_30d ALTER COLUMN total_points SET STATISTICS 1000;
  ALTER TABLE leaderboard_30d ALTER COLUMN name SET STATISTICS 1000;
  ALTER TABLE leaderboard_30d ALTER COLUMN handle SET STATISTICS 1000;
  ALTER TABLE leaderboard_30d ALTER COLUMN school SET STATISTICS 500;
  
  ALTER TABLE activity_metrics ALTER COLUMN total_submissions SET STATISTICS 1000;
  ALTER TABLE activity_metrics ALTER COLUMN approved_submissions SET STATISTICS 1000;
END $$;

-- Function to get index usage statistics (for monitoring)
CREATE OR REPLACE FUNCTION get_materialized_view_index_stats()
RETURNS TABLE (
  schemaname text,
  tablename text,
  indexname text,
  idx_scan bigint,
  idx_tup_read bigint,
  idx_tup_fetch bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.schemaname,
    s.tablename,
    s.indexname,
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch
  FROM pg_stat_user_indexes s
  WHERE s.tablename IN ('leaderboard_totals', 'leaderboard_30d', 'activity_metrics')
  ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comments to document the indexing strategy
COMMENT ON FUNCTION get_materialized_view_index_stats() IS 'Monitor index usage on materialized views for performance optimization';

-- Create a monitoring view for materialized view performance
CREATE OR REPLACE VIEW materialized_view_performance AS
SELECT 
  schemaname,
  matviewname as view_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size,
  n_tup_ins as rows_inserted,
  n_tup_upd as rows_updated,
  n_tup_del as rows_deleted,
  n_tup_hot_upd as hot_updates,
  seq_scan as sequential_scans,
  seq_tup_read as sequential_tuples_read,
  idx_scan as index_scans,
  idx_tup_fetch as index_tuples_fetched
FROM pg_stat_user_tables 
WHERE schemaname = 'public' 
  AND relname IN ('leaderboard_totals', 'leaderboard_30d', 'activity_metrics');

COMMENT ON VIEW materialized_view_performance IS 'Performance monitoring view for materialized views';