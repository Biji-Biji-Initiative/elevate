-- Schema consolidation migration to sync with Prisma schema
-- This migration adds missing fields, tables, and business logic

-- Add missing kajabi_contact_id field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS kajabi_contact_id TEXT UNIQUE;

-- Create submission_attachments table (new in Prisma schema)
CREATE TABLE IF NOT EXISTS submission_attachments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id TEXT NOT NULL,
    path TEXT NOT NULL,
    hash TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT submission_attachments_submission_id_fkey 
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    UNIQUE(submission_id, path)
);

-- Create indexes for submission_attachments
CREATE INDEX IF NOT EXISTS idx_submission_attachments_submission_id ON submission_attachments(submission_id);

-- Add amplify quota enforcement trigger (from Prisma migration 004)
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

  -- Extract new values from JSON payload
  new_peers := COALESCE( (NEW.payload->>'peersTrained')::int, 0 );
  new_students := COALESCE( (NEW.payload->>'studentsTrained')::int, 0 );

  -- Sum existing values in last 7 days
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

-- Apply the trigger (drop first to avoid conflicts)
DROP TRIGGER IF EXISTS trg_check_amplify_quota ON submissions;
CREATE TRIGGER trg_check_amplify_quota
BEFORE INSERT ON submissions
FOR EACH ROW
EXECUTE PROCEDURE check_amplify_quota();

-- Add unique constraint for LEARN submissions (from Prisma migration 003)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_learn_active_submission
ON submissions (user_id)
WHERE activity_code = 'LEARN' AND status IN ('PENDING', 'APPROVED');

-- Ensure external_event_id remains unique (defensive)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_points_external_event
ON points_ledger ((COALESCE(external_event_id, '')))
WHERE external_event_id IS NOT NULL;

-- Enable RLS on new submission_attachments table
ALTER TABLE submission_attachments ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for submission_attachments
CREATE POLICY "submission_attachments_select_own" ON submission_attachments
    FOR SELECT USING (
        submission_id IN (
            SELECT id FROM submissions WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY "submission_attachments_reviewer_all" ON submission_attachments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::text 
            AND role IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
        )
    );

-- Add index for kajabi_contact_id lookups
CREATE INDEX IF NOT EXISTS idx_users_kajabi_contact_id ON users(kajabi_contact_id)
WHERE kajabi_contact_id IS NOT NULL;

-- Add comment to document the consolidation
COMMENT ON TABLE submission_attachments IS 'File attachment tracking for submissions - added during schema consolidation';