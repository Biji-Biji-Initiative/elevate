-- Align leaderboard materialized views with API expectations
-- Drops old views if present and recreates with required columns

DO $$ BEGIN
  PERFORM 1 FROM pg_matviews WHERE matviewname = 'leaderboard_totals';
  IF FOUND THEN
    EXECUTE 'DROP MATERIALIZED VIEW leaderboard_totals';
  END IF;
END $$;

DO $$ BEGIN
  PERFORM 1 FROM pg_matviews WHERE matviewname = 'leaderboard_30d';
  IF FOUND THEN
    EXECUTE 'DROP MATERIALIZED VIEW leaderboard_30d';
  END IF;
END $$;

-- All-time leaderboard
CREATE MATERIALIZED VIEW leaderboard_totals AS
SELECT 
  u.id              AS user_id,
  u.handle          AS handle,
  u.name            AS name,
  u.avatar_url      AS avatar_url,
  u.school          AS school,
  u.cohort          AS cohort,
  COALESCE(SUM(pl.delta_points), 0) AS total_points,
  COALESCE(
    SUM(
      CASE WHEN s.status = 'APPROVED' AND s.visibility = 'PUBLIC' THEN 1 ELSE 0 END
    ), 0
  ) AS public_submissions,
  MAX(
    CASE WHEN s.status = 'APPROVED' THEN s.updated_at ELSE NULL END
  ) AS last_activity_at
FROM users u
LEFT JOIN points_ledger pl ON pl.user_id = u.id
LEFT JOIN submissions s ON s.user_id = u.id
WHERE u.role IN ('PARTICIPANT','REVIEWER','ADMIN','SUPERADMIN')
GROUP BY u.id, u.handle, u.name, u.avatar_url, u.school, u.cohort;

CREATE INDEX leaderboard_totals_points_idx ON leaderboard_totals(total_points DESC);
CREATE INDEX leaderboard_totals_last_activity_idx ON leaderboard_totals((COALESCE(last_activity_at, '1970-01-01'::timestamp))) ;

-- 30-day rolling leaderboard
CREATE MATERIALIZED VIEW leaderboard_30d AS
SELECT 
  u.id              AS user_id,
  u.handle          AS handle,
  u.name            AS name,
  u.avatar_url      AS avatar_url,
  u.school          AS school,
  u.cohort          AS cohort,
  COALESCE(SUM(pl.delta_points), 0) AS total_points,
  COALESCE(
    SUM(
      CASE WHEN s.status = 'APPROVED' AND s.visibility = 'PUBLIC' AND s.updated_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 ELSE 0 END
    ), 0
  ) AS public_submissions,
  MAX(
    CASE WHEN s.status = 'APPROVED' AND s.updated_at >= CURRENT_DATE - INTERVAL '30 days' THEN s.updated_at ELSE NULL END
  ) AS last_activity_at
FROM users u
LEFT JOIN points_ledger pl ON pl.user_id = u.id AND pl.created_at >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN submissions s ON s.user_id = u.id
WHERE u.role IN ('PARTICIPANT','REVIEWER','ADMIN','SUPERADMIN')
GROUP BY u.id, u.handle, u.name, u.avatar_url, u.school, u.cohort;

CREATE INDEX leaderboard_30d_points_idx ON leaderboard_30d(total_points DESC);
CREATE INDEX leaderboard_30d_last_activity_idx ON leaderboard_30d((COALESCE(last_activity_at, '1970-01-01'::timestamp))) ;

-- Helper: function to refresh both views (non-concurrent for local dev)
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW leaderboard_totals;
  REFRESH MATERIALIZED VIEW leaderboard_30d;
END;
$$ LANGUAGE plpgsql;



