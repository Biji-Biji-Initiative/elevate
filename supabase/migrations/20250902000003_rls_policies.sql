-- Row Level Security (RLS) policies for MS Elevate LEAPS Tracker

-- Enable RLS on all tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "points_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "badges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "earned_badges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kajabi_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id TEXT)
RETURNS "Role" AS $$
BEGIN
    RETURN (SELECT role FROM users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users table policies
CREATE POLICY "users_select_public" ON "users"
    FOR SELECT USING (true); -- Public profiles are viewable by anyone

CREATE POLICY "users_select_own" ON "users"
    FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "users_update_own" ON "users"
    FOR UPDATE USING (auth.uid()::text = id);

CREATE POLICY "users_admin_all" ON "users"
    FOR ALL USING (
        get_user_role(auth.uid()::text) IN ('ADMIN', 'SUPERADMIN')
    );

-- Activities table policies (read-only for participants, admin can manage)
CREATE POLICY "activities_select_all" ON "activities"
    FOR SELECT USING (true);

CREATE POLICY "activities_admin_all" ON "activities"
    FOR ALL USING (
        get_user_role(auth.uid()::text) IN ('ADMIN', 'SUPERADMIN')
    );

-- Submissions table policies
CREATE POLICY "submissions_select_own" ON "submissions"
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "submissions_select_public" ON "submissions"
    FOR SELECT USING (visibility = 'PUBLIC' AND status = 'APPROVED');

CREATE POLICY "submissions_insert_own" ON "submissions"
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "submissions_update_own" ON "submissions"
    FOR UPDATE USING (
        auth.uid()::text = user_id 
        AND status = 'PENDING' -- Can only update pending submissions
    );

CREATE POLICY "submissions_reviewer_all" ON "submissions"
    FOR ALL USING (
        get_user_role(auth.uid()::text) IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
    );

-- Points ledger policies (append-only audit trail)
CREATE POLICY "points_ledger_select_own" ON "points_ledger"
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "points_ledger_select_public_summary" ON "points_ledger"
    FOR SELECT USING (true); -- Needed for leaderboard calculations

CREATE POLICY "points_ledger_insert_system" ON "points_ledger"
    FOR INSERT WITH CHECK (
        get_user_role(auth.uid()::text) IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
        OR auth.uid() IS NULL -- Allow system/webhook inserts
    );

-- Badges table policies
CREATE POLICY "badges_select_all" ON "badges"
    FOR SELECT USING (true);

CREATE POLICY "badges_admin_all" ON "badges"
    FOR ALL USING (
        get_user_role(auth.uid()::text) IN ('ADMIN', 'SUPERADMIN')
    );

-- Earned badges policies
CREATE POLICY "earned_badges_select_own" ON "earned_badges"
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "earned_badges_select_public" ON "earned_badges"
    FOR SELECT USING (true); -- Public badges are viewable

CREATE POLICY "earned_badges_insert_system" ON "earned_badges"
    FOR INSERT WITH CHECK (
        get_user_role(auth.uid()::text) IN ('ADMIN', 'SUPERADMIN')
        OR auth.uid() IS NULL -- Allow system inserts
    );

-- Kajabi events policies (admin only)
CREATE POLICY "kajabi_events_admin_all" ON "kajabi_events"
    FOR ALL USING (
        get_user_role(auth.uid()::text) IN ('ADMIN', 'SUPERADMIN')
    );

-- Audit log policies (admin read, system write)
CREATE POLICY "audit_log_select_admin" ON "audit_log"
    FOR SELECT USING (
        get_user_role(auth.uid()::text) IN ('ADMIN', 'SUPERADMIN')
    );

CREATE POLICY "audit_log_insert_system" ON "audit_log"
    FOR INSERT WITH CHECK (true); -- Allow system inserts for auditing

-- Create a function to safely insert audit logs
CREATE OR REPLACE FUNCTION insert_audit_log(
    p_actor_id TEXT,
    p_action TEXT,
    p_target_id TEXT DEFAULT NULL,
    p_meta JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO audit_log (actor_id, action, target_id, meta)
    VALUES (p_actor_id, p_action, p_target_id, p_meta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;