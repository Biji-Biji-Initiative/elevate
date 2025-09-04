-- Migration to fix database triggers to expect snake_case field names
-- This aligns triggers with Prisma-first schema design
-- Part of comprehensive refactor to make Prisma schema the source of truth

-- Fix amplify quota trigger to expect snake_case field names
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

  -- Extract new values from JSON payload (now using snake_case)
  new_peers := COALESCE( (NEW.payload->>'peers_trained')::int, 0 );
  new_students := COALESCE( (NEW.payload->>'students_trained')::int, 0 );

  -- Sum existing values in last 7 days (now using snake_case)
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

-- Recreate the trigger (drop first to avoid conflicts)
DROP TRIGGER IF EXISTS trg_check_amplify_quota ON submissions;
CREATE TRIGGER trg_check_amplify_quota
BEFORE INSERT ON submissions
FOR EACH ROW
EXECUTE PROCEDURE check_amplify_quota();

-- Comment for tracking
COMMENT ON FUNCTION check_amplify_quota() IS 'Enforces 7-day rolling limits for AMPLIFY submissions using snake_case field names aligned with Prisma schema';