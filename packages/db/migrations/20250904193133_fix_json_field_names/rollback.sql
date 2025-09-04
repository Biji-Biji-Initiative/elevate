-- ROLLBACK: Revert JSON field name fixes (snake_case back to camelCase)
-- Migration: 20250904193133_fix_json_field_names
-- Created: 2025-09-04
-- Purpose: Rollback script to revert snake_case field names back to camelCase

-- =============================================================================
-- WARNING: This rollback will restore the BROKEN state!
-- =============================================================================
-- Only use this rollback if you need to revert for debugging purposes.
-- The camelCase field names are incompatible with our application schemas.

-- =============================================================================
-- 1. REVERT AMPLIFY QUOTA TRIGGER TO CAMELCASE
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

  -- Extract new values from JSON payload using camelCase field names (BROKEN)
  new_peers := COALESCE( (NEW.payload->>'peersTrained')::int, 0 );
  new_students := COALESCE( (NEW.payload->>'studentsTrained')::int, 0 );

  -- Sum existing values in last 7 days using camelCase field names (BROKEN)
  SELECT
    COALESCE(SUM( (s.payload->>'peersTrained')::int ), 0),
    COALESCE(SUM( (s.payload->>'studentsTrained')::int ), 0)
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
-- 2. REVERT PAYLOAD VALIDATION CONSTRAINTS TO CAMELCASE
-- =============================================================================

-- Drop snake_case constraints
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS chk_amplify_payload;
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS chk_present_payload;
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS chk_learn_payload;

-- Restore camelCase constraints (BROKEN)
ALTER TABLE submissions ADD CONSTRAINT chk_amplify_payload 
CHECK (
    activity_code != 'AMPLIFY' OR (
        payload ? 'peersTrained' AND 
        payload ? 'studentsTrained' AND
        (payload->>'peersTrained')::int >= 0 AND
        (payload->>'studentsTrained')::int >= 0 AND
        (payload->>'peersTrained')::int <= 50 AND
        (payload->>'studentsTrained')::int <= 200
    )
);

ALTER TABLE submissions ADD CONSTRAINT chk_present_payload 
CHECK (
    activity_code != 'PRESENT' OR (
        payload ? 'linkedinUrl' AND 
        payload->>'linkedinUrl' ~ '^https://linkedin\.com/'
    )
);

ALTER TABLE submissions ADD CONSTRAINT chk_learn_payload 
CHECK (
    activity_code != 'LEARN' OR (
        payload ? 'certificateName' AND 
        LENGTH(payload->>'certificateName') > 0
    )
);

-- =============================================================================
-- 3. REVERT URL VALIDATION TRIGGER TO CAMELCASE
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_submission_urls() RETURNS trigger AS $$
BEGIN
    -- Validate LinkedIn URL for PRESENT submissions using camelCase (BROKEN)
    IF NEW.activity_code = 'PRESENT' AND NEW.payload ? 'linkedinUrl' THEN
        IF NOT (NEW.payload->>'linkedinUrl' ~ '^https?://(www\.)?linkedin\.com/') THEN
            RAISE EXCEPTION 'Invalid LinkedIn URL format'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. REVERT CERTIFICATE HASH UNIQUENESS TRIGGER TO CAMELCASE
-- =============================================================================

CREATE OR REPLACE FUNCTION check_certificate_hash_uniqueness() RETURNS trigger AS $$
DECLARE
    existing_count integer;
BEGIN
    -- Only check for LEARN submissions with certificate hashes (camelCase field - BROKEN)
    IF NEW.activity_code != 'LEARN' OR NEW.payload->>'certificateHash' IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check for duplicate certificate hash in approved LEARN submissions
    SELECT COUNT(*) INTO existing_count
    FROM submissions s
    WHERE s.activity_code = 'LEARN'
      AND s.status = 'APPROVED'
      AND s.payload->>'certificateHash' = NEW.payload->>'certificateHash'
      AND s.user_id != NEW.user_id;

    IF existing_count > 0 THEN
        RAISE EXCEPTION 'Certificate hash already exists for another approved LEARN submission'
            USING ERRCODE = '23505';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. REVERT PERFORMANCE INDEXES TO CAMELCASE
-- =============================================================================

-- Drop snake_case indexes
DROP INDEX IF EXISTS idx_submissions_learn_cert_hash;

-- Create camelCase indexes (BROKEN)
CREATE INDEX IF NOT EXISTS idx_submissions_learn_cert_hash 
ON submissions((payload->>'certificateHash')) 
WHERE activity_code = 'LEARN' AND status = 'APPROVED' AND payload->>'certificateHash' IS NOT NULL;

-- =============================================================================
-- 6. DATA ROLLBACK - Convert snake_case payloads back to camelCase
-- =============================================================================

-- WARNING: This rollback converts data back to the BROKEN camelCase format

-- Rollback AMPLIFY submissions: peers_trained → peersTrained, students_trained → studentsTrained
UPDATE submissions 
SET payload = payload || jsonb_build_object(
    'peersTrained', payload->>'peers_trained',
    'studentsTrained', payload->>'students_trained'
) - 'peers_trained' - 'students_trained'
WHERE activity_code = 'AMPLIFY' 
  AND (payload ? 'peers_trained' OR payload ? 'students_trained');

-- Rollback PRESENT submissions: linkedin_url → linkedinUrl
UPDATE submissions 
SET payload = payload || jsonb_build_object(
    'linkedinUrl', payload->>'linkedin_url'
) - 'linkedin_url'
WHERE activity_code = 'PRESENT' 
  AND payload ? 'linkedin_url';

-- Rollback LEARN submissions: course_name → certificateName, certificate_hash → certificateHash
UPDATE submissions 
SET payload = payload || jsonb_build_object(
    'certificateName', payload->>'course_name',
    'certificateHash', payload->>'certificate_hash'
) - 'course_name' - 'certificate_hash'
WHERE activity_code = 'LEARN' 
  AND (payload ? 'course_name' OR payload ? 'certificate_hash');

-- Rollback EXPLORE submissions: class_date → classDate, evidence_files → evidenceFiles
UPDATE submissions 
SET payload = payload || jsonb_build_object(
    'classDate', payload->>'class_date',
    'evidenceFiles', payload->'evidence_files'
) - 'class_date' - 'evidence_files'
WHERE activity_code = 'EXPLORE' 
  AND (payload ? 'class_date' OR payload ? 'evidence_files');

-- Rollback SHINE submissions: idea_title → ideaTitle, idea_summary → ideaSummary
UPDATE submissions 
SET payload = payload || jsonb_build_object(
    'ideaTitle', payload->>'idea_title',
    'ideaSummary', payload->>'idea_summary'
) - 'idea_title' - 'idea_summary'
WHERE activity_code = 'SHINE' 
  AND (payload ? 'idea_title' OR payload ? 'idea_summary');

-- =============================================================================
-- ROLLBACK COMPLETE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== ROLLBACK COMPLETE (SYSTEM IS NOW BROKEN!) ===';
    RAISE NOTICE 'Rollback 20250904193133_fix_json_field_names completed';
    RAISE NOTICE 'WARNING: Database now uses camelCase but application expects snake_case';
    RAISE NOTICE 'WARNING: Submissions will fail until you fix the field name mismatch!';
    RAISE NOTICE '=== IMMEDIATE ACTION REQUIRED ===';
END $$;