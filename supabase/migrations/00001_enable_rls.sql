-- Enable Row Level Security on all tables
-- This migration sets up RLS as the foundation for data security

-- Enable RLS on all core tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE earned_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE kajabi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create a function to get the current user's role from JWT
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT AS $$
BEGIN
  -- Extract role from JWT claims
  RETURN COALESCE(
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role',
    (auth.jwt() ->> 'public_metadata')::jsonb ->> 'role',
    'PARTICIPANT'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user is admin or above
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.get_user_role() IN ('ADMIN', 'SUPERADMIN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user is reviewer or above
CREATE OR REPLACE FUNCTION auth.is_reviewer()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.get_user_role() IN ('REVIEWER', 'ADMIN', 'SUPERADMIN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get the current user's ID from JWT
CREATE OR REPLACE FUNCTION auth.get_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.uid()::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON FUNCTION auth.get_user_role() IS 'Extract user role from JWT token';
COMMENT ON FUNCTION auth.is_admin() IS 'Check if current user has admin privileges';
COMMENT ON FUNCTION auth.is_reviewer() IS 'Check if current user has reviewer privileges';
COMMENT ON FUNCTION auth.get_user_id() IS 'Get current user ID from JWT token';

-- Create indexes for better RLS performance
CREATE INDEX IF NOT EXISTS idx_users_id_role ON users(id, role);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id_status ON submissions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_points_ledger_user_id ON points_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_earned_badges_user_id ON earned_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);