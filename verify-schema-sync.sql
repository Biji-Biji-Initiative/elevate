-- Schema Consistency Verification Script
-- Run this against the database to verify Prisma and Supabase schemas are in sync

-- Check if all expected tables exist
SELECT 
    'Table Existence Check' as check_type,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users') as users_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'activities') as activities_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'submissions') as submissions_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'points_ledger') as points_ledger_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'badges') as badges_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'earned_badges') as earned_badges_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'kajabi_events') as kajabi_events_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'submission_attachments') as submission_attachments_exists,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') as audit_log_exists;

-- Check if critical columns exist
SELECT 
    'Column Existence Check' as check_type,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'kajabi_contact_id') as kajabi_contact_id_exists,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'attachments') as attachments_column_exists,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'submission_attachments' AND column_name = 'hash') as attachment_hash_exists;

-- Check if materialized views exist
SELECT 
    'Materialized Views Check' as check_type,
    EXISTS(SELECT 1 FROM pg_matviews WHERE matviewname = 'leaderboard_totals') as leaderboard_totals_exists,
    EXISTS(SELECT 1 FROM pg_matviews WHERE matviewname = 'leaderboard_30d') as leaderboard_30d_exists,
    EXISTS(SELECT 1 FROM pg_matviews WHERE matviewname = 'activity_metrics') as activity_metrics_exists;

-- Check if critical functions exist
SELECT 
    'Functions Check' as check_type,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'check_amplify_quota') as amplify_quota_function_exists,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'refresh_leaderboards') as refresh_function_exists;

-- Check if triggers exist
SELECT 
    'Triggers Check' as check_type,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'trg_check_amplify_quota') as amplify_quota_trigger_exists,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'update_submissions_updated_at') as update_trigger_exists;

-- Check if critical indexes exist
SELECT 
    'Indexes Check' as check_type,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'uniq_learn_active_submission') as learn_constraint_exists,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'users_kajabi_contact_id_key') as kajabi_index_exists,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'submission_attachments_submission_id_idx') as attachment_index_exists;

-- Count records in critical tables
SELECT 
    'Record Counts' as check_type,
    (SELECT COUNT(*) FROM users) as users_count,
    (SELECT COUNT(*) FROM activities) as activities_count,
    (SELECT COUNT(*) FROM submissions) as submissions_count,
    (SELECT COUNT(*) FROM points_ledger) as points_count;

-- Show any schema inconsistencies
SELECT 
    'Potential Issues' as check_type,
    CASE 
        WHEN NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'submission_attachments') 
        THEN 'submission_attachments table missing'
        WHEN NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'kajabi_contact_id')
        THEN 'kajabi_contact_id column missing'
        WHEN NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'trg_check_amplify_quota')
        THEN 'amplify quota trigger missing'
        ELSE 'Schema appears consistent'
    END as status;