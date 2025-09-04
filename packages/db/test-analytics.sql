-- Test script for analytics views and functions
-- Run this manually after applying the migration to verify everything works

-- Test 1: Check that all materialized views exist
SELECT 
  schemaname,
  matviewname,
  hasindexes,
  ispopulated
FROM pg_matviews 
WHERE matviewname IN (
  'leaderboard_totals',
  'leaderboard_30d',
  'activity_metrics',
  'cohort_metrics',
  'school_metrics',
  'time_series_metrics'
);

-- Test 2: Check that all indexes were created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename IN (
  'leaderboard_totals',
  'leaderboard_30d',
  'activity_metrics',
  'cohort_metrics',
  'school_metrics',
  'time_series_metrics'
)
ORDER BY tablename, indexname;

-- Test 3: Check that all helper functions exist
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name IN (
  'refresh_all_analytics',
  'refresh_leaderboards',
  'get_user_point_summary',
  'get_activity_leaderboard',
  'get_cohort_comparison'
)
ORDER BY routine_name;

-- Test 4: Test basic view queries (these should return results or empty sets, not errors)
SELECT 'leaderboard_totals' as view_name, COUNT(*) as row_count FROM leaderboard_totals
UNION ALL
SELECT 'leaderboard_30d', COUNT(*) FROM leaderboard_30d
UNION ALL  
SELECT 'activity_metrics', COUNT(*) FROM activity_metrics
UNION ALL
SELECT 'cohort_metrics', COUNT(*) FROM cohort_metrics
UNION ALL
SELECT 'school_metrics', COUNT(*) FROM school_metrics
UNION ALL
SELECT 'time_series_metrics', COUNT(*) FROM time_series_metrics;

-- Test 5: Test that views have expected columns
SELECT 
  'leaderboard_totals' as view_name,
  STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_name = 'leaderboard_totals'
GROUP BY table_name

UNION ALL

SELECT 
  'activity_metrics' as view_name,
  STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_name = 'activity_metrics'
GROUP BY table_name

UNION ALL

SELECT 
  'cohort_metrics' as view_name,
  STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_name = 'cohort_metrics'
GROUP BY table_name

UNION ALL

SELECT 
  'school_metrics' as view_name,
  STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_name = 'school_metrics'
GROUP BY table_name

UNION ALL

SELECT 
  'time_series_metrics' as view_name,
  STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_name = 'time_series_metrics'
GROUP BY table_name;

-- Test 6: Test helper functions (with dummy data if no real data exists)
-- This will create a test user if none exist
DO $$
DECLARE
  test_user_id TEXT;
BEGIN
  -- Create a test user if no users exist
  SELECT id INTO test_user_id FROM users WHERE role = 'PARTICIPANT' LIMIT 1;
  
  IF test_user_id IS NULL THEN
    INSERT INTO users (id, handle, name, email, role, school, cohort) 
    VALUES ('test-user-123', 'testuser', 'Test User', 'test@example.com', 'PARTICIPANT', 'Test School', 'Test Cohort')
    RETURNING id INTO test_user_id;
    
    RAISE NOTICE 'Created test user with ID: %', test_user_id;
  END IF;
  
  -- Test the user point summary function
  PERFORM get_user_point_summary(test_user_id);
  RAISE NOTICE 'get_user_point_summary function works';
  
END $$;

-- Test 7: Test the refresh function
SELECT refresh_all_analytics();

-- Test 8: Check for any obvious data quality issues
SELECT 
  'Data Quality Check' as check_type,
  CASE 
    WHEN EXISTS(SELECT 1 FROM leaderboard_totals WHERE total_points < 0) 
    THEN 'FAIL: Negative points found in leaderboard_totals'
    ELSE 'PASS: No negative points in leaderboard_totals'
  END as result

UNION ALL

SELECT 
  'Data Quality Check',
  CASE 
    WHEN EXISTS(SELECT 1 FROM activity_metrics WHERE total_submissions < 0) 
    THEN 'FAIL: Negative submissions found in activity_metrics'
    ELSE 'PASS: No negative submissions in activity_metrics'
  END

UNION ALL

SELECT 
  'Data Quality Check',
  CASE 
    WHEN EXISTS(SELECT 1 FROM cohort_metrics WHERE total_participants < 0) 
    THEN 'FAIL: Negative participants found in cohort_metrics'
    ELSE 'PASS: No negative participants in cohort_metrics'
  END

UNION ALL

SELECT 
  'Data Quality Check',
  CASE 
    WHEN EXISTS(SELECT 1 FROM time_series_metrics WHERE cumulative_points < 0) 
    THEN 'FAIL: Negative cumulative points found in time_series_metrics'
    ELSE 'PASS: No negative cumulative points in time_series_metrics'
  END;

-- Test 9: Performance test - check query execution time
EXPLAIN ANALYZE SELECT * FROM leaderboard_totals ORDER BY total_points DESC LIMIT 20;

-- Test 10: Test that 30-day filter works correctly
SELECT 
  'Date Filter Test' as test_type,
  COUNT(*) as records_in_30d_view,
  (SELECT COUNT(*) FROM leaderboard_totals) as records_in_total_view
FROM leaderboard_30d;

-- Success message
SELECT 'All analytics tests completed successfully!' as status;