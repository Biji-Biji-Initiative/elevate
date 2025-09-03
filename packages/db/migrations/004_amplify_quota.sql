-- Enforce 7-day rolling limits for AMPLIFY submissions
-- peersTrained <= 50 and studentsTrained <= 200 including the new row

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

DROP TRIGGER IF EXISTS trg_check_amplify_quota ON submissions;
CREATE TRIGGER trg_check_amplify_quota
BEFORE INSERT ON submissions
FOR EACH ROW
EXECUTE PROCEDURE check_amplify_quota();

