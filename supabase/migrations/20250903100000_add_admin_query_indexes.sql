-- Optimize admin list endpoints

-- Submissions filters/sorting
CREATE INDEX IF NOT EXISTS idx_submissions_status_created_at ON submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_activity_created_at ON submissions (activity_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions (user_id);

-- Users filters/sorting
CREATE INDEX IF NOT EXISTS idx_users_role_created_at ON users (role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_cohort_created_at ON users (cohort, created_at DESC);

-- Points ledger lookups
CREATE INDEX IF NOT EXISTS idx_points_ledger_user_created_at ON points_ledger (user_id, created_at DESC);

