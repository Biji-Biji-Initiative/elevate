-- Optimize admin list endpoints

-- Submissions filters/sorting
CREATE INDEX IF NOT EXISTS idx_submission_status_created_at ON submission (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submission_activity_created_at ON submission (activity_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submission_user_id ON submission (user_id);

-- Users filters/sorting (note: "user" is a reserved word)
CREATE INDEX IF NOT EXISTS idx_user_role_created_at ON "user" (role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_cohort_created_at ON "user" (cohort, created_at DESC);

-- Points ledger lookups
CREATE INDEX IF NOT EXISTS idx_points_ledger_user_created_at ON points_ledger (user_id, created_at DESC);

