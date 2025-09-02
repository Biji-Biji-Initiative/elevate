-- Points ledger and audit policies
-- Controls access to points data and audit logs

-- Points Ledger Policies
-- Users can view their own points history
CREATE POLICY "Users can view own points" ON points_ledger
  FOR SELECT
  TO authenticated
  USING (user_id = auth.get_user_id());

-- Reviewers can view all points (for audit purposes)
CREATE POLICY "Reviewers can view all points" ON points_ledger
  FOR SELECT
  TO authenticated
  USING (auth.is_reviewer());

-- Only reviewers can create points entries (through approvals)
CREATE POLICY "Reviewers can create points entries" ON points_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_reviewer());

-- Points entries are append-only (no updates allowed)
-- This ensures audit trail integrity

-- Only admins can delete points entries (for corrections)
CREATE POLICY "Admins can delete points entries" ON points_ledger
  FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Service role can insert points (for Kajabi webhook)
CREATE POLICY "Service role can insert points" ON points_ledger
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Audit Log Policies
-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON audit_log
  FOR SELECT
  TO authenticated
  USING (auth.is_admin());

-- All authenticated users can create audit entries for their actions
CREATE POLICY "Users can create audit entries" ON audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.get_user_id());

-- Service role can create audit entries (for system actions)
CREATE POLICY "Service role can create audit entries" ON audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Audit logs are append-only (no updates or deletes)
-- This ensures complete audit trail

-- Create views for leaderboard data (with RLS)
CREATE OR REPLACE VIEW leaderboard_totals AS
SELECT 
  u.id,
  u.handle,
  u.name,
  u.school,
  u.cohort,
  COALESCE(SUM(pl.delta_points), 0) as total_points,
  COUNT(DISTINCT s.id) as submission_count,
  MAX(s.updated_at) as last_activity
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id
LEFT JOIN submissions s ON u.id = s.user_id AND s.status = 'APPROVED' AND s.visibility = 'PUBLIC'
WHERE u.id IN (
  -- Only include users with public submissions or current user
  SELECT DISTINCT user_id FROM submissions WHERE visibility = 'PUBLIC'
  UNION
  SELECT auth.get_user_id()
)
GROUP BY u.id, u.handle, u.name, u.school, u.cohort
ORDER BY total_points DESC;

CREATE OR REPLACE VIEW leaderboard_30d AS
SELECT 
  u.id,
  u.handle,
  u.name,
  u.school,
  u.cohort,
  COALESCE(SUM(
    CASE 
      WHEN pl.created_at >= NOW() - INTERVAL '30 days' 
      THEN pl.delta_points 
      ELSE 0 
    END
  ), 0) as total_points,
  COUNT(DISTINCT CASE 
    WHEN s.updated_at >= NOW() - INTERVAL '30 days' AND s.status = 'APPROVED' AND s.visibility = 'PUBLIC'
    THEN s.id 
  END) as submission_count
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id
LEFT JOIN submissions s ON u.id = s.user_id AND s.status = 'APPROVED' AND s.visibility = 'PUBLIC'
WHERE u.id IN (
  -- Only include users with public submissions or current user
  SELECT DISTINCT user_id FROM submissions WHERE visibility = 'PUBLIC'
  UNION
  SELECT auth.get_user_id()
)
GROUP BY u.id, u.handle, u.name, u.school, u.cohort
ORDER BY total_points DESC;

-- Create a view for points summary per user
CREATE OR REPLACE VIEW user_points_summary AS
SELECT 
  u.id,
  u.handle,
  COALESCE(SUM(pl.delta_points), 0) as total_points,
  COALESCE(SUM(CASE WHEN pl.activity_code = 'LEARN' THEN pl.delta_points ELSE 0 END), 0) as learn_points,
  COALESCE(SUM(CASE WHEN pl.activity_code = 'EXPLORE' THEN pl.delta_points ELSE 0 END), 0) as explore_points,
  COALESCE(SUM(CASE WHEN pl.activity_code = 'AMPLIFY' THEN pl.delta_points ELSE 0 END), 0) as amplify_points,
  COALESCE(SUM(CASE WHEN pl.activity_code = 'PRESENT' THEN pl.delta_points ELSE 0 END), 0) as present_points,
  COALESCE(SUM(CASE WHEN pl.activity_code = 'SHINE' THEN pl.delta_points ELSE 0 END), 0) as shine_points,
  COUNT(pl.id) as total_entries,
  MAX(pl.created_at) as last_points_earned
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id
GROUP BY u.id, u.handle;

-- Grant access to views
GRANT SELECT ON leaderboard_totals TO authenticated;
GRANT SELECT ON leaderboard_30d TO authenticated;
GRANT SELECT ON user_points_summary TO authenticated;

-- Add RLS to views (inherit from underlying tables)
ALTER VIEW leaderboard_totals SET (security_barrier = true);
ALTER VIEW leaderboard_30d SET (security_barrier = true);
ALTER VIEW user_points_summary SET (security_barrier = true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_points_ledger_created_at ON points_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_points_ledger_activity_points ON points_ledger(activity_code, delta_points);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Add helpful functions for points calculations
CREATE OR REPLACE FUNCTION get_user_total_points(target_user_id TEXT)
RETURNS INTEGER AS $$
BEGIN
  -- Only allow users to get their own points or admins to get any points
  IF target_user_id = auth.get_user_id() OR auth.is_admin() THEN
    RETURN (
      SELECT COALESCE(SUM(delta_points), 0)
      FROM points_ledger
      WHERE user_id = target_user_id
    );
  ELSE
    RETURN NULL; -- No permission
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON POLICY "Users can view own points" ON points_ledger IS 'Users can see their points history';
COMMENT ON POLICY "Reviewers can create points entries" ON points_ledger IS 'Points awarded through review process';
COMMENT ON POLICY "Admins can view audit logs" ON audit_log IS 'Audit logs for administrative oversight';

COMMENT ON VIEW leaderboard_totals IS 'All-time leaderboard with public submissions only';
COMMENT ON VIEW leaderboard_30d IS '30-day rolling leaderboard';
COMMENT ON VIEW user_points_summary IS 'Points breakdown per user by activity';

COMMENT ON FUNCTION get_user_total_points IS 'Get total points for a user (with permission check)';