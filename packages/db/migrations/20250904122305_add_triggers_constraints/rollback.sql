-- Rollback Migration: Remove Triggers & Constraints
-- Created: 2025-09-04
-- Purpose: Rollback script for 20250904122305_add_triggers_constraints migration

-- =============================================================================
-- 1. DROP ALL TRIGGERS
-- =============================================================================

DROP TRIGGER IF EXISTS audit_users_changes ON users;
DROP TRIGGER IF EXISTS audit_points_changes ON points_ledger;
DROP TRIGGER IF EXISTS audit_submission_status_changes ON submissions;
DROP TRIGGER IF EXISTS trg_check_certificate_hash ON submissions;
DROP TRIGGER IF EXISTS trg_validate_urls ON submissions;
DROP TRIGGER IF EXISTS trg_validate_user_email ON users;
DROP TRIGGER IF EXISTS trg_refresh_on_points_change ON points_ledger;
DROP TRIGGER IF EXISTS trg_refresh_on_submission_change ON submissions;
DROP TRIGGER IF EXISTS trg_refresh_on_user_change ON users;
DROP TRIGGER IF EXISTS trg_check_submission_rate_limit ON submissions;
DROP TRIGGER IF EXISTS trg_check_single_attempt ON submissions;
DROP TRIGGER IF EXISTS trg_cleanup_attachments ON submissions;
DROP TRIGGER IF EXISTS trg_validate_status_transition ON submissions;
DROP TRIGGER IF EXISTS trg_validate_role_change ON users;

-- =============================================================================
-- 2. DROP ALL TRIGGER FUNCTIONS
-- =============================================================================

DROP FUNCTION IF EXISTS audit_trigger_func();
DROP FUNCTION IF EXISTS check_certificate_hash_uniqueness();
DROP FUNCTION IF EXISTS validate_submission_urls();
DROP FUNCTION IF EXISTS validate_user_email();
DROP FUNCTION IF EXISTS trigger_refresh_analytics();
DROP FUNCTION IF EXISTS check_submission_rate_limit();
DROP FUNCTION IF EXISTS check_single_attempt_activities();
DROP FUNCTION IF EXISTS cleanup_orphaned_attachments();
DROP FUNCTION IF EXISTS validate_status_transition();
DROP FUNCTION IF EXISTS validate_role_change();

-- =============================================================================
-- 3. DROP ALL RLS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS user_select_policy ON users;
DROP POLICY IF EXISTS user_update_policy ON users;
DROP POLICY IF EXISTS user_insert_policy ON users;
DROP POLICY IF EXISTS submission_select_policy ON submissions;
DROP POLICY IF EXISTS submission_insert_policy ON submissions;
DROP POLICY IF EXISTS submission_update_policy ON submissions;
DROP POLICY IF EXISTS points_ledger_select_policy ON points_ledger;
DROP POLICY IF EXISTS points_ledger_insert_policy ON points_ledger;
DROP POLICY IF EXISTS earned_badge_select_policy ON earned_badges;
DROP POLICY IF EXISTS earned_badge_insert_policy ON earned_badges;
DROP POLICY IF EXISTS audit_log_select_policy ON audit_log;
DROP POLICY IF EXISTS audit_log_insert_policy ON audit_log;
DROP POLICY IF EXISTS attachment_select_policy ON submission_attachments;
DROP POLICY IF EXISTS attachment_insert_policy ON submission_attachments;

-- =============================================================================
-- 4. DISABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE earned_badges DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE submission_attachments DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. DROP ALL CHECK CONSTRAINTS
-- =============================================================================

ALTER TABLE points_ledger DROP CONSTRAINT IF EXISTS chk_points_bounds;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_handle_pattern;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_email_format;
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS chk_amplify_payload;
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS chk_present_payload;
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS chk_learn_payload;
ALTER TABLE points_ledger DROP CONSTRAINT IF EXISTS chk_external_event_unique;

-- =============================================================================
-- 6. DROP PERFORMANCE INDEXES
-- =============================================================================

DROP INDEX IF EXISTS idx_submissions_user_created_recent;
DROP INDEX IF EXISTS idx_submissions_learn_cert_hash;
DROP INDEX IF EXISTS idx_submissions_user_activity_status;

-- =============================================================================
-- ROLLBACK COMPLETE
-- =============================================================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Rollback of migration 20250904122305_add_triggers_constraints completed';
    RAISE NOTICE 'All triggers, constraints, RLS policies, and related indexes have been removed';
END $$;