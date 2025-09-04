-- Rollback Migration: Optimize Submission Attachments
-- Created: 2025-09-04
-- Purpose: Rollback attachment optimizations (indexes, constraints, triggers)

-- =============================================================================
-- 1. DROP BUSINESS RULE TRIGGERS
-- =============================================================================

DROP TRIGGER IF EXISTS trg_check_attachment_limits ON submission_attachments;
DROP TRIGGER IF EXISTS trg_prevent_attachment_modification ON submission_attachments;
DROP TRIGGER IF EXISTS audit_attachment_changes ON submission_attachments;

-- =============================================================================
-- 2. DROP TRIGGER FUNCTIONS
-- =============================================================================

DROP FUNCTION IF EXISTS check_attachment_limits();
DROP FUNCTION IF EXISTS prevent_attachment_modification();

-- =============================================================================
-- 3. DROP MAINTENANCE FUNCTIONS
-- =============================================================================

DROP FUNCTION IF EXISTS find_orphaned_attachments(integer);
DROP FUNCTION IF EXISTS find_duplicate_attachments();

-- =============================================================================
-- 4. DROP VALIDATION CONSTRAINTS
-- =============================================================================

ALTER TABLE submission_attachments DROP CONSTRAINT IF EXISTS chk_attachment_path_format;
ALTER TABLE submission_attachments DROP CONSTRAINT IF EXISTS chk_attachment_hash_format;
ALTER TABLE submission_attachments DROP CONSTRAINT IF EXISTS chk_attachment_path_not_empty;
ALTER TABLE submission_attachments DROP CONSTRAINT IF EXISTS chk_attachment_path_length;

-- =============================================================================
-- 5. DROP PERFORMANCE INDEXES
-- =============================================================================

DROP INDEX IF EXISTS idx_submission_attachments_hash;
DROP INDEX IF EXISTS idx_submission_attachments_submission_hash;
DROP INDEX IF EXISTS idx_submission_attachments_path;

-- =============================================================================
-- ROLLBACK COMPLETE
-- =============================================================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Rollback 20250904123000_optimize_attachments completed successfully';
    RAISE NOTICE 'Removed: All attachment optimization features';
    RAISE NOTICE 'Note: Core attachment table and basic indexes remain intact';
END $$;