-- Add helpful indexes to support common query patterns

-- Submissions by status (admin queues)
CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions(status);

-- Submissions composite for user/status (user dashboards)
CREATE INDEX IF NOT EXISTS submissions_user_status_idx ON submissions(user_id, status);

-- Users by cohort filters
CREATE INDEX IF NOT EXISTS users_cohort_idx ON users(cohort);

