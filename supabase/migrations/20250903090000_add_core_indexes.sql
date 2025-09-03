-- Add useful indexes for performance (idempotent)
DO $$ BEGIN
  -- Submissions by activity/status/dates and visibility
  CREATE INDEX IF NOT EXISTS idx_submissions_activity_status ON submissions (activity_code, status);
  CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions (user_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_updated_at ON submissions (updated_at);
  CREATE INDEX IF NOT EXISTS idx_submissions_visibility ON submissions (visibility);

  -- Points ledger by user/activity/date
  CREATE INDEX IF NOT EXISTS idx_points_user ON points_ledger (user_id);
  CREATE INDEX IF NOT EXISTS idx_points_activity ON points_ledger (activity_code);
  CREATE INDEX IF NOT EXISTS idx_points_created_at ON points_ledger (created_at);

  -- Users by cohort/school
  CREATE INDEX IF NOT EXISTS idx_users_cohort ON users (cohort);
  CREATE INDEX IF NOT EXISTS idx_users_school ON users (school);
END $$;

