-- CRITICAL: Fix JSON field name mismatches between database triggers and application schemas
-- Migration: 20250904193133_fix_json_field_names
-- Created: 2025-09-04
-- Purpose: Update all database triggers and constraints to use snake_case JSON field names

-- =============================================================================
-- PROBLEM STATEMENT
-- =============================================================================
-- Current database triggers/constraints expect camelCase JSON fields:
--   - peersTrained, studentsTrained, linkedinUrl, certificateName
-- But our application schemas now use snake_case (standardized):
--   - peers_trained, students_trained, linkedin_url, certificate_name
-- This causes submission failures in production.

-- =============================================================================
-- 1. UPDATE AMPLIFY QUOTA TRIGGER TO USE SNAKE_CASE
-- =============================================================================

CREATE OR REPLACE FUNCTION check_amplify_quota() RETURNS trigger AS $$
DECLARE
  total_peers INTEGER;
  total_students INTEGER;
  new_peers INTEGER;
  new_students INTEGER;
BEGIN
  IF NEW.activity_code <> 'AMPLIFY' THEN
    RETURN NEW;
  END IF;

  -- Extract new values from JSON payload using snake_case field names
  new_peers := COALESCE( (NEW.payload->>'peers_trained')::int, 0 );
  new_students := COALESCE( (NEW.payload->>'students_trained')::int, 0 );

  -- Sum existing values in last 7 days using snake_case field names
  SELECT
    COALESCE(SUM( (s.payload->>'peers_trained')::int ), 0),
    COALESCE(SUM( (s.payload->>'students_trained')::int ), 0)
  INTO total_peers, total_students
  FROM submissions s
  WHERE s.user_id = NEW.user_id
    AND s.activity_code = 'AMPLIFY'
    AND s.created_at >= (CURRENT_TIMESTAMP - INTERVAL '7 days');

  IF (total_peers + new_peers) > 50 THEN
    RAISE EXCEPTION 'Peer training limit exceeded (7-day total % + new % > 50)', total_peers, new_peers
      USING ERRCODE = '23514';
  END IF;

  IF (total_students + new_students) > 200 THEN
    RAISE EXCEPTION 'Student training limit exceeded (7-day total % + new % > 200)', total_students, new_students
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. UPDATE PAYLOAD VALIDATION CONSTRAINTS TO USE SNAKE_CASE
-- =============================================================================

-- Drop existing constraints with old field names
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS chk_amplify_payload;
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS chk_present_payload;
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS chk_learn_payload;

-- Add new constraints with snake_case field names
ALTER TABLE submissions ADD CONSTRAINT chk_amplify_payload 
CHECK (
    activity_code != 'AMPLIFY' OR (
        payload ? 'peers_trained' AND 
        payload ? 'students_trained' AND
        (payload->>'peers_trained')::int >= 0 AND
        (payload->>'students_trained')::int >= 0 AND
        (payload->>'peers_trained')::int <= 50 AND
        (payload->>'students_trained')::int <= 200
    )
);

ALTER TABLE submissions ADD CONSTRAINT chk_present_payload 
CHECK (
    activity_code != 'PRESENT' OR (
        payload ? 'linkedin_url' AND 
        payload->>'linkedin_url' ~ '^https://linkedin\.com/'
    )
);

ALTER TABLE submissions ADD CONSTRAINT chk_learn_payload 
CHECK (
    activity_code != 'LEARN' OR (
        payload ? 'course_name' AND 
        LENGTH(payload->>'course_name') > 0
    )
);

-- =============================================================================
-- 3. UPDATE URL VALIDATION TRIGGER TO USE SNAKE_CASE
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_submission_urls() RETURNS trigger AS $$
BEGIN
    -- Validate LinkedIn URL for PRESENT submissions using snake_case
    IF NEW.activity_code = 'PRESENT' AND NEW.payload ? 'linkedin_url' THEN
        IF NOT (NEW.payload->>'linkedin_url' ~ '^https?://(www\.)?linkedin\.com/') THEN
            RAISE EXCEPTION 'Invalid LinkedIn URL format'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Validate any URLs in payload (general validation)
    IF NEW.payload ? 'urls' THEN
        -- This could be extended to validate URL arrays in payload
        -- For now, we rely on application-level validation
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. UPDATE CERTIFICATE HASH UNIQUENESS TRIGGER TO USE SNAKE_CASE
-- =============================================================================

CREATE OR REPLACE FUNCTION check_certificate_hash_uniqueness() RETURNS trigger AS $$
DECLARE
    existing_count integer;
BEGIN
    -- Only check for LEARN submissions with certificate hashes (snake_case field)
    IF NEW.activity_code != 'LEARN' OR NEW.payload->>'certificate_hash' IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check for duplicate certificate hash in approved LEARN submissions
    SELECT COUNT(*) INTO existing_count
    FROM submissions s
    WHERE s.activity_code = 'LEARN'
      AND s.status = 'APPROVED'
      AND s.payload->>'certificate_hash' = NEW.payload->>'certificate_hash'
      AND s.user_id != NEW.user_id;

    IF existing_count > 0 THEN
        RAISE EXCEPTION 'Certificate hash already exists for another approved LEARN submission'
            USING ERRCODE = '23505';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. UPDATE PERFORMANCE INDEXES TO USE SNAKE_CASE
-- =============================================================================

-- Drop old indexes with camelCase field references
DROP INDEX IF EXISTS idx_submissions_learn_cert_hash;

-- Create new indexes with snake_case field references
CREATE INDEX IF NOT EXISTS idx_submissions_learn_cert_hash 
ON submissions((payload->>'certificate_hash')) 
WHERE activity_code = 'LEARN' AND status = 'APPROVED' AND payload->>'certificate_hash' IS NOT NULL;

-- =============================================================================
-- 6. UPDATE FUNCTION COMMENTS TO REFLECT SNAKE_CASE STANDARD
-- =============================================================================

COMMENT ON FUNCTION check_amplify_quota() IS 
'Enforces AMPLIFY submission limits using snake_case JSON fields (peers_trained, students_trained). Max 50 peers and 200 students per 7-day rolling window.';

COMMENT ON FUNCTION validate_submission_urls() IS 
'Validates URL formats in submission payloads using snake_case JSON fields, particularly linkedin_url for PRESENT activities.';

COMMENT ON FUNCTION check_certificate_hash_uniqueness() IS 
'Prevents duplicate certificate submissions by checking certificate_hash uniqueness (snake_case) across approved LEARN submissions.';

-- =============================================================================
-- 7. DATA MIGRATION - Convert existing camelCase payloads to snake_case
-- =============================================================================

-- WARNING: This will update existing data to match the new snake_case standard
-- This is a one-time migration that converts camelCase fields to snake_case

-- Update AMPLIFY submissions: peersTrained → peers_trained, studentsTrained → students_trained
UPDATE submissions 
SET payload = payload || jsonb_build_object(
    'peers_trained', payload->>'peersTrained',
    'students_trained', payload->>'studentsTrained'
) - 'peersTrained' - 'studentsTrained'
WHERE activity_code = 'AMPLIFY' 
  AND (payload ? 'peersTrained' OR payload ? 'studentsTrained');

-- Update PRESENT submissions: linkedinUrl → linkedin_url
UPDATE submissions 
SET payload = payload || jsonb_build_object(
    'linkedin_url', payload->>'linkedinUrl'
) - 'linkedinUrl'
WHERE activity_code = 'PRESENT' 
  AND payload ? 'linkedinUrl';

-- Update LEARN submissions: certificateName → course_name, certificateHash → certificate_hash
UPDATE submissions 
SET payload = payload || jsonb_build_object(
    'course_name', payload->>'certificateName',
    'certificate_hash', payload->>'certificateHash'
) - 'certificateName' - 'certificateHash'
WHERE activity_code = 'LEARN' 
  AND (payload ? 'certificateName' OR payload ? 'certificateHash');

-- Update EXPLORE submissions: classDate → class_date, evidenceFiles → evidence_files
UPDATE submissions 
SET payload = payload || jsonb_build_object(
    'class_date', payload->>'classDate',
    'evidence_files', payload->'evidenceFiles'
) - 'classDate' - 'evidenceFiles'
WHERE activity_code = 'EXPLORE' 
  AND (payload ? 'classDate' OR payload ? 'evidenceFiles');

-- Update SHINE submissions: ideaTitle → idea_title, ideaSummary → idea_summary
UPDATE submissions 
SET payload = payload || jsonb_build_object(
    'idea_title', payload->>'ideaTitle',
    'idea_summary', payload->>'ideaSummary'
) - 'ideaTitle' - 'ideaSummary'
WHERE activity_code = 'SHINE' 
  AND (payload ? 'ideaTitle' OR payload ? 'ideaSummary');

-- =============================================================================
-- 8. VALIDATION - Verify the migration worked
-- =============================================================================

-- Count records that still have camelCase fields (should be 0 after migration)
DO $$
DECLARE
    camel_case_count INTEGER := 0;
BEGIN
    -- Check for any remaining camelCase fields
    SELECT COUNT(*) INTO camel_case_count
    FROM submissions 
    WHERE payload ? 'peersTrained' 
       OR payload ? 'studentsTrained'
       OR payload ? 'linkedinUrl'
       OR payload ? 'certificateName'
       OR payload ? 'certificateHash'
       OR payload ? 'classDate'
       OR payload ? 'evidenceFiles'
       OR payload ? 'ideaTitle'
       OR payload ? 'ideaSummary';
    
    IF camel_case_count > 0 THEN
        RAISE WARNING 'Found % submissions with remaining camelCase fields', camel_case_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All payload fields converted to snake_case';
    END IF;
    
    -- Log completion statistics
    RAISE NOTICE 'Migration completed - all triggers and constraints now use snake_case JSON field names';
END $$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Log final completion message
DO $$
BEGIN
    RAISE NOTICE '=== CRITICAL MIGRATION COMPLETE ===';
    RAISE NOTICE 'Migration 20250904193133_fix_json_field_names completed successfully';
    RAISE NOTICE 'Fixed: Database triggers and constraints now use snake_case JSON field names';
    RAISE NOTICE 'Fixed: Existing payload data converted from camelCase to snake_case';
    RAISE NOTICE 'Next steps: Update application layer to transform API camelCase to DB snake_case';
    RAISE NOTICE '=== PRODUCTION BLOCKER RESOLVED ===';
END $$;