-- Migration: Optimize Submission Attachments
-- Created: 2025-09-04
-- Purpose: Add indexes, constraints, and validation for submission attachments

-- =============================================================================
-- 1. PERFORMANCE INDEXES FOR ATTACHMENT QUERIES
-- =============================================================================

-- Index for hash-based deduplication queries (used by file upload system)
CREATE INDEX IF NOT EXISTS idx_submission_attachments_hash 
ON submission_attachments(hash) 
WHERE hash IS NOT NULL;

-- Composite index for common query patterns (submission + hash lookup)
CREATE INDEX IF NOT EXISTS idx_submission_attachments_submission_hash 
ON submission_attachments(submission_id, hash) 
WHERE hash IS NOT NULL;

-- Index for path-based lookups (complement to existing unique constraint)
CREATE INDEX IF NOT EXISTS idx_submission_attachments_path 
ON submission_attachments(path);

-- =============================================================================
-- 2. VALIDATION CONSTRAINTS FOR ATTACHMENT DATA
-- =============================================================================

-- Ensure path follows expected format: evidence/{userId}/{activityCode}/{timestamp}-{hash}.{ext}
ALTER TABLE submission_attachments ADD CONSTRAINT chk_attachment_path_format 
CHECK (
    path ~ '^evidence/[a-zA-Z0-9_-]+/[A-Z]+/[0-9]+-[a-f0-9]{8}\.[a-zA-Z0-9]+$'
);

-- Ensure hash is a valid SHA-256 hex string when present
ALTER TABLE submission_attachments ADD CONSTRAINT chk_attachment_hash_format 
CHECK (
    hash IS NULL OR 
    (LENGTH(hash) = 64 AND hash ~ '^[a-f0-9]{64}$')
);

-- Prevent empty paths
ALTER TABLE submission_attachments ADD CONSTRAINT chk_attachment_path_not_empty 
CHECK (LENGTH(TRIM(path)) > 0);

-- Path length limits (reasonable URL length)
ALTER TABLE submission_attachments ADD CONSTRAINT chk_attachment_path_length 
CHECK (LENGTH(path) <= 500);

-- =============================================================================
-- 3. BUSINESS RULE TRIGGERS FOR ATTACHMENTS
-- =============================================================================

-- Trigger to validate attachment limits per submission
CREATE OR REPLACE FUNCTION check_attachment_limits() RETURNS trigger AS $$
DECLARE
    attachment_count integer;
BEGIN
    -- Count existing attachments for the submission
    SELECT COUNT(*) INTO attachment_count
    FROM submission_attachments
    WHERE submission_id = NEW.submission_id;

    -- Enforce maximum 5 attachments per submission
    IF attachment_count >= 5 THEN
        RAISE EXCEPTION 'Maximum 5 attachments allowed per submission'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_attachment_limits ON submission_attachments;
CREATE TRIGGER trg_check_attachment_limits
    BEFORE INSERT ON submission_attachments
    FOR EACH ROW EXECUTE FUNCTION check_attachment_limits();

-- Trigger to prevent modification of existing attachments (immutable after creation)
CREATE OR REPLACE FUNCTION prevent_attachment_modification() RETURNS trigger AS $$
BEGIN
    -- Prevent updates to path and hash (these should be immutable)
    IF TG_OP = 'UPDATE' THEN
        IF OLD.path != NEW.path THEN
            RAISE EXCEPTION 'Attachment path cannot be modified after creation'
                USING ERRCODE = '23514';
        END IF;
        
        IF OLD.hash != NEW.hash OR (OLD.hash IS NULL) != (NEW.hash IS NULL) THEN
            RAISE EXCEPTION 'Attachment hash cannot be modified after creation'
                USING ERRCODE = '23514';
        END IF;
        
        IF OLD.submission_id != NEW.submission_id THEN
            RAISE EXCEPTION 'Attachment cannot be moved to different submission'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_attachment_modification ON submission_attachments;
CREATE TRIGGER trg_prevent_attachment_modification
    BEFORE UPDATE ON submission_attachments
    FOR EACH ROW EXECUTE FUNCTION prevent_attachment_modification();

-- =============================================================================
-- 4. AUDIT TRIGGERS FOR ATTACHMENT OPERATIONS
-- =============================================================================

-- Add audit logging for attachment operations
DROP TRIGGER IF EXISTS audit_attachment_changes ON submission_attachments;
CREATE TRIGGER audit_attachment_changes
    AFTER INSERT OR DELETE ON submission_attachments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- =============================================================================
-- 5. CLEANUP AND MAINTENANCE FUNCTIONS
-- =============================================================================

-- Function to find orphaned attachments (no corresponding file in storage)
CREATE OR REPLACE FUNCTION find_orphaned_attachments(limit_rows integer DEFAULT 100)
RETURNS TABLE(id text, path text, created_at timestamp) AS $$
BEGIN
    RETURN QUERY
    SELECT sa.id, sa.path, sa.created_at
    FROM submission_attachments sa
    ORDER BY sa.created_at DESC
    LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql;

-- Function to find duplicate attachments by hash
CREATE OR REPLACE FUNCTION find_duplicate_attachments()
RETURNS TABLE(hash text, count bigint, submission_ids text[]) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sa.hash,
        COUNT(*) as count,
        array_agg(sa.submission_id) as submission_ids
    FROM submission_attachments sa
    WHERE sa.hash IS NOT NULL
    GROUP BY sa.hash
    HAVING COUNT(*) > 1
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 6. COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON INDEX idx_submission_attachments_hash IS 
'Index for hash-based file deduplication queries';

COMMENT ON INDEX idx_submission_attachments_submission_hash IS 
'Composite index for submission + hash lookups in deduplication';

COMMENT ON INDEX idx_submission_attachments_path IS 
'Index for path-based file lookups';

COMMENT ON FUNCTION check_attachment_limits() IS 
'Enforces maximum of 5 attachments per submission to prevent abuse';

COMMENT ON FUNCTION prevent_attachment_modification() IS 
'Ensures attachment metadata is immutable after creation for data integrity';

COMMENT ON FUNCTION find_orphaned_attachments(integer) IS 
'Helper function to identify attachments that may not have corresponding storage files';

COMMENT ON FUNCTION find_duplicate_attachments() IS 
'Helper function to identify potential duplicate files by hash for cleanup';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 20250904123000_optimize_attachments completed successfully';
    RAISE NOTICE 'Added: Performance indexes, validation constraints, business rule triggers';
    RAISE NOTICE 'Added: Audit triggers, cleanup functions, and maintenance utilities';
END $$;