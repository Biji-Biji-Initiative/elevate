-- Admin-focused indexes to improve query performance for new features

-- Audit log filters: by target_id, action, actor_id with created_at ordering
CREATE INDEX IF NOT EXISTS ix_audit_target_time ON audit_log(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_action_time ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_actor_time ON audit_log(actor_id, created_at DESC);

-- Users list: filter by user_type and cohort, order by created_at
CREATE INDEX IF NOT EXISTS ix_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS ix_users_user_type_time ON users(user_type, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_users_cohort_time ON users(cohort, created_at DESC);

