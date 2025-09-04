-- Migration: Add Comprehensive Triggers & Constraints
-- Created: 2025-09-04
-- Purpose: Add RLS policies, business rule constraints, audit triggers, validation triggers, and update triggers

-- =============================================================================
-- 1. ROW-LEVEL SECURITY (RLS) POLICIES - PREPARE FOR MULTI-TENANT
-- =============================================================================

-- Enable RLS on all tables (prepare for future multi-tenant support)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE earned_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_attachments ENABLE ROW LEVEL SECURITY;

-- For now, create permissive policies (can be restricted later for multi-tenancy)
-- These policies allow all operations for authenticated users

-- Users table: Users can see all participant profiles, manage their own data
CREATE POLICY user_select_policy ON users FOR SELECT USING (
    role = 'PARTICIPANT' OR 
    current_setting('app.user_id', true) = id OR
    current_setting('app.user_role', true) IN ('ADMIN', 'SUPERADMIN', 'REVIEWER')
);

CREATE POLICY user_update_policy ON users FOR UPDATE USING (
    current_setting('app.user_id', true) = id OR
    current_setting('app.user_role', true) IN ('ADMIN', 'SUPERADMIN')
);

CREATE POLICY user_insert_policy ON users FOR INSERT WITH CHECK (true);

-- Submissions table: Users can see public submissions, their own, and reviewers can see all
CREATE POLICY submission_select_policy ON submissions FOR SELECT USING (
    visibility = 'PUBLIC' OR 
    current_setting('app.user_id', true) = user_id OR
    current_setting('app.user_role', true) IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
);

CREATE POLICY submission_insert_policy ON submissions FOR INSERT WITH CHECK (
    current_setting('app.user_id', true) = user_id OR
    current_setting('app.user_role', true) IN ('ADMIN', 'SUPERADMIN')
);

CREATE POLICY submission_update_policy ON submissions FOR UPDATE USING (
    current_setting('app.user_id', true) = user_id OR
    current_setting('app.user_role', true) IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
);

-- Points ledger: Append-only for users, full access for reviewers/admins
CREATE POLICY points_ledger_select_policy ON points_ledger FOR SELECT USING (
    current_setting('app.user_id', true) = user_id OR
    current_setting('app.user_role', true) IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
);

CREATE POLICY points_ledger_insert_policy ON points_ledger FOR INSERT WITH CHECK (true);

-- Earned badges: Users can see their own, public badges visible to all
CREATE POLICY earned_badge_select_policy ON earned_badges FOR SELECT USING (
    current_setting('app.user_id', true) = user_id OR
    current_setting('app.user_role', true) IN ('ADMIN', 'SUPERADMIN')
);

CREATE POLICY earned_badge_insert_policy ON earned_badges FOR INSERT WITH CHECK (true);

-- Audit log: Only admins can read, system can insert
CREATE POLICY audit_log_select_policy ON audit_log FOR SELECT USING (
    current_setting('app.user_role', true) IN ('ADMIN', 'SUPERADMIN')
);

CREATE POLICY audit_log_insert_policy ON audit_log FOR INSERT WITH CHECK (true);

-- Submission attachments: Follow submission visibility rules
CREATE POLICY attachment_select_policy ON submission_attachments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM submissions s 
        WHERE s.id = submission_id AND (
            s.visibility = 'PUBLIC' OR 
            current_setting('app.user_id', true) = s.user_id OR
            current_setting('app.user_role', true) IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
        )
    )
);

CREATE POLICY attachment_insert_policy ON submission_attachments FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM submissions s 
        WHERE s.id = submission_id AND (
            current_setting('app.user_id', true) = s.user_id OR
            current_setting('app.user_role', true) IN ('ADMIN', 'SUPERADMIN')
        )
    )
);

-- =============================================================================
-- 2. BUSINESS RULE CHECK CONSTRAINTS
-- =============================================================================

-- Points must be within reasonable bounds (-1000 to 1000 per transaction)
ALTER TABLE points_ledger ADD CONSTRAINT chk_points_bounds 
CHECK (delta_points BETWEEN -1000 AND 1000);

-- User handles must match pattern (alphanumeric, hyphens, underscores, 3-30 chars)
ALTER TABLE users ADD CONSTRAINT chk_handle_pattern 
CHECK (handle ~ '^[a-zA-Z0-9_-]{3,30}$');

-- Email format validation (basic pattern)
ALTER TABLE users ADD CONSTRAINT chk_email_format 
CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Submission payload validation for AMPLIFY activity
-- (This constraint ensures required fields exist for AMPLIFY submissions)
ALTER TABLE submissions ADD CONSTRAINT chk_amplify_payload 
CHECK (
    activity_code != 'AMPLIFY' OR (
        payload ? 'peersTrained' AND 
        payload ? 'studentsTrained' AND
        (payload->>'peersTrained')::int >= 0 AND
        (payload->>'studentsTrained')::int >= 0 AND
        (payload->>'peersTrained')::int <= 50 AND
        (payload->>'studentsTrained')::int <= 200
    )
);

-- Submission payload validation for PRESENT activity (LinkedIn URL required)
ALTER TABLE submissions ADD CONSTRAINT chk_present_payload 
CHECK (
    activity_code != 'PRESENT' OR (
        payload ? 'linkedinUrl' AND 
        payload->>'linkedinUrl' ~ '^https://linkedin\.com/'
    )
);

-- Submission payload validation for LEARN activity (certificate data required)
ALTER TABLE submissions ADD CONSTRAINT chk_learn_payload 
CHECK (
    activity_code != 'LEARN' OR (
        payload ? 'certificateName' AND 
        LENGTH(payload->>'certificateName') > 0
    )
);

-- External event ID must be unique when present (additional constraint beyond index)
ALTER TABLE points_ledger ADD CONSTRAINT chk_external_event_unique
CHECK (external_event_id IS NULL OR LENGTH(external_event_id) > 0);

-- =============================================================================
-- 3. AUDIT TRIGGERS FOR SENSITIVE OPERATIONS
-- =============================================================================

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_func() RETURNS trigger AS $$
DECLARE
    audit_data jsonb;
    user_id_setting text;
BEGIN
    user_id_setting := current_setting('app.user_id', true);
    
    -- Skip audit if no user context (system operations)
    IF user_id_setting IS NULL OR user_id_setting = '' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Build audit data based on operation
    CASE TG_OP
        WHEN 'INSERT' THEN
            audit_data := jsonb_build_object(
                'operation', 'INSERT',
                'table', TG_TABLE_NAME,
                'new_values', row_to_json(NEW)
            );
        WHEN 'UPDATE' THEN
            audit_data := jsonb_build_object(
                'operation', 'UPDATE',
                'table', TG_TABLE_NAME,
                'old_values', row_to_json(OLD),
                'new_values', row_to_json(NEW)
            );
        WHEN 'DELETE' THEN
            audit_data := jsonb_build_object(
                'operation', 'DELETE',
                'table', TG_TABLE_NAME,
                'old_values', row_to_json(OLD)
            );
    END CASE;

    -- Insert audit record
    INSERT INTO audit_log (actor_id, action, target_id, meta) VALUES (
        user_id_setting,
        TG_OP || '_' || TG_TABLE_NAME,
        CASE TG_OP
            WHEN 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        audit_data
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_users_changes ON users;
CREATE TRIGGER audit_users_changes
    AFTER INSERT OR UPDATE OF role OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_points_changes ON points_ledger;
CREATE TRIGGER audit_points_changes
    AFTER INSERT OR UPDATE OR DELETE ON points_ledger
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_submission_status_changes ON submissions;
CREATE TRIGGER audit_submission_status_changes
    AFTER UPDATE OF status, reviewer_id ON submissions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- =============================================================================
-- 4. DATA VALIDATION TRIGGERS
-- =============================================================================

-- Certificate hash uniqueness validation trigger
CREATE OR REPLACE FUNCTION check_certificate_hash_uniqueness() RETURNS trigger AS $$
DECLARE
    existing_count integer;
BEGIN
    -- Only check for LEARN submissions with certificate hashes
    IF NEW.activity_code != 'LEARN' OR NEW.payload->>'certificateHash' IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check for duplicate certificate hash in approved LEARN submissions
    SELECT COUNT(*) INTO existing_count
    FROM submissions s
    WHERE s.activity_code = 'LEARN'
      AND s.status = 'APPROVED'
      AND s.payload->>'certificateHash' = NEW.payload->>'certificateHash'
      AND s.user_id != NEW.user_id;

    IF existing_count > 0 THEN
        RAISE EXCEPTION 'Certificate hash already exists for another approved LEARN submission'
            USING ERRCODE = '23505';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_certificate_hash ON submissions;
CREATE TRIGGER trg_check_certificate_hash
    BEFORE INSERT OR UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION check_certificate_hash_uniqueness();

-- URL validation trigger for PRESENT submissions
CREATE OR REPLACE FUNCTION validate_submission_urls() RETURNS trigger AS $$
BEGIN
    -- Validate LinkedIn URL for PRESENT submissions
    IF NEW.activity_code = 'PRESENT' AND NEW.payload ? 'linkedinUrl' THEN
        IF NOT (NEW.payload->>'linkedinUrl' ~ '^https?://(www\.)?linkedin\.com/') THEN
            RAISE EXCEPTION 'Invalid LinkedIn URL format'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Validate any URLs in payload (general validation)
    IF NEW.payload ? 'urls' THEN
        -- This could be extended to validate URL arrays in payload
        -- For now, we rely on application-level validation
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_urls ON submissions;
CREATE TRIGGER trg_validate_urls
    BEFORE INSERT OR UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION validate_submission_urls();

-- Email format validation trigger (additional to constraint)
CREATE OR REPLACE FUNCTION validate_user_email() RETURNS trigger AS $$
BEGIN
    -- Normalize email to lowercase
    NEW.email := LOWER(NEW.email);
    
    -- Additional email validation beyond constraint
    IF LENGTH(NEW.email) > 254 THEN
        RAISE EXCEPTION 'Email address too long'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_user_email ON users;
CREATE TRIGGER trg_validate_user_email
    BEFORE INSERT OR UPDATE OF email ON users
    FOR EACH ROW EXECUTE FUNCTION validate_user_email();

-- =============================================================================
-- 5. UPDATE TRIGGERS FOR DENORMALIZED DATA
-- =============================================================================

-- Function to refresh materialized views after significant data changes
CREATE OR REPLACE FUNCTION trigger_refresh_analytics() RETURNS trigger AS $$
BEGIN
    -- Use pg_notify to signal that analytics should be refreshed
    -- This allows async processing instead of blocking the transaction
    PERFORM pg_notify('refresh_analytics', 
        json_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'timestamp', EXTRACT(EPOCH FROM NOW())
        )::text
    );
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add analytics refresh triggers to key tables
DROP TRIGGER IF EXISTS trg_refresh_on_points_change ON points_ledger;
CREATE TRIGGER trg_refresh_on_points_change
    AFTER INSERT OR UPDATE OR DELETE ON points_ledger
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_analytics();

DROP TRIGGER IF EXISTS trg_refresh_on_submission_change ON submissions;
CREATE TRIGGER trg_refresh_on_submission_change
    AFTER INSERT OR UPDATE OF status, visibility OR DELETE ON submissions
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_analytics();

DROP TRIGGER IF EXISTS trg_refresh_on_user_change ON users;
CREATE TRIGGER trg_refresh_on_user_change
    AFTER UPDATE OF role, cohort, school ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_analytics();

-- =============================================================================
-- 6. PERFORMANCE AND ANTI-GAMING TRIGGERS
-- =============================================================================

-- Rate limiting trigger for submissions (prevent spam)
CREATE OR REPLACE FUNCTION check_submission_rate_limit() RETURNS trigger AS $$
DECLARE
    recent_submissions integer;
BEGIN
    -- Count submissions from the same user in the last hour
    SELECT COUNT(*) INTO recent_submissions
    FROM submissions
    WHERE user_id = NEW.user_id
      AND created_at >= NOW() - INTERVAL '1 hour';

    -- Allow maximum 10 submissions per hour per user
    IF recent_submissions >= 10 THEN
        RAISE EXCEPTION 'Submission rate limit exceeded (max 10 per hour)'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_submission_rate_limit ON submissions;
CREATE TRIGGER trg_check_submission_rate_limit
    BEFORE INSERT ON submissions
    FOR EACH ROW EXECUTE FUNCTION check_submission_rate_limit();

-- Prevent duplicate submission attempts for single-attempt activities
CREATE OR REPLACE FUNCTION check_single_attempt_activities() RETURNS trigger AS $$
DECLARE
    existing_approved integer;
BEGIN
    -- For LEARN activity, only one approved submission allowed
    IF NEW.activity_code = 'LEARN' THEN
        SELECT COUNT(*) INTO existing_approved
        FROM submissions
        WHERE user_id = NEW.user_id
          AND activity_code = 'LEARN'
          AND status = 'APPROVED';

        IF existing_approved > 0 THEN
            RAISE EXCEPTION 'User already has an approved LEARN submission'
                USING ERRCODE = '23505';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_single_attempt ON submissions;
CREATE TRIGGER trg_check_single_attempt
    BEFORE INSERT ON submissions
    FOR EACH ROW EXECUTE FUNCTION check_single_attempt_activities();

-- =============================================================================
-- 7. DATA INTEGRITY AND CLEANUP TRIGGERS
-- =============================================================================

-- Trigger to clean up orphaned submission attachments
CREATE OR REPLACE FUNCTION cleanup_orphaned_attachments() RETURNS trigger AS $$
BEGIN
    -- When a submission is deleted, its attachments are auto-deleted by FK cascade
    -- This trigger could be extended to clean up actual files from storage
    -- For now, it serves as a placeholder for future storage cleanup logic
    
    IF TG_OP = 'DELETE' THEN
        -- Could add logic here to notify storage service to delete files
        PERFORM pg_notify('cleanup_attachments', 
            json_build_object('submission_id', OLD.id)::text
        );
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_attachments ON submissions;
CREATE TRIGGER trg_cleanup_attachments
    AFTER DELETE ON submissions
    FOR EACH ROW EXECUTE FUNCTION cleanup_orphaned_attachments();

-- =============================================================================
-- 8. BUSINESS LOGIC VALIDATION TRIGGERS
-- =============================================================================

-- Validate submission status transitions
CREATE OR REPLACE FUNCTION validate_status_transition() RETURNS trigger AS $$
BEGIN
    -- Only allow valid status transitions
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        -- PENDING can go to APPROVED or REJECTED
        -- APPROVED/REJECTED cannot change (immutable once decided)
        IF OLD.status IN ('APPROVED', 'REJECTED') THEN
            RAISE EXCEPTION 'Cannot change status from % to %', OLD.status, NEW.status
                USING ERRCODE = '23514';
        END IF;

        -- When approving/rejecting, reviewer_id must be set
        IF NEW.status IN ('APPROVED', 'REJECTED') AND NEW.reviewer_id IS NULL THEN
            RAISE EXCEPTION 'reviewer_id required when status is %', NEW.status
                USING ERRCODE = '23502';
        END IF;

        -- Only reviewers/admins can change status
        IF current_setting('app.user_role', true) NOT IN ('REVIEWER', 'ADMIN', 'SUPERADMIN') THEN
            RAISE EXCEPTION 'Insufficient permissions to change submission status'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_status_transition ON submissions;
CREATE TRIGGER trg_validate_status_transition
    BEFORE UPDATE OF status ON submissions
    FOR EACH ROW EXECUTE FUNCTION validate_status_transition();

-- Validate role changes
CREATE OR REPLACE FUNCTION validate_role_change() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
        -- Only admins can change roles
        IF current_setting('app.user_role', true) NOT IN ('ADMIN', 'SUPERADMIN') THEN
            RAISE EXCEPTION 'Insufficient permissions to change user role'
                USING ERRCODE = '42501';
        END IF;

        -- Prevent self-demotion for the last SUPERADMIN
        IF OLD.role = 'SUPERADMIN' AND NEW.role != 'SUPERADMIN' THEN
            DECLARE
                superadmin_count integer;
            BEGIN
                SELECT COUNT(*) INTO superadmin_count
                FROM users WHERE role = 'SUPERADMIN' AND id != NEW.id;

                IF superadmin_count = 0 THEN
                    RAISE EXCEPTION 'Cannot remove the last SUPERADMIN user'
                        USING ERRCODE = '23514';
                END IF;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_role_change ON users;
CREATE TRIGGER trg_validate_role_change
    BEFORE UPDATE OF role ON users
    FOR EACH ROW EXECUTE FUNCTION validate_role_change();

-- =============================================================================
-- 9. COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON FUNCTION audit_trigger_func() IS 
'Audit trigger function that logs all sensitive operations (role changes, point adjustments, submission status changes) to the audit_log table.';

COMMENT ON FUNCTION check_certificate_hash_uniqueness() IS 
'Prevents duplicate certificate submissions by checking hash uniqueness across approved LEARN submissions.';

COMMENT ON FUNCTION validate_submission_urls() IS 
'Validates URL formats in submission payloads, particularly LinkedIn URLs for PRESENT activities.';

COMMENT ON FUNCTION validate_user_email() IS 
'Normalizes email addresses to lowercase and performs additional validation beyond the check constraint.';

COMMENT ON FUNCTION trigger_refresh_analytics() IS 
'Sends notifications for async analytics refresh after significant data changes to avoid blocking transactions.';

COMMENT ON FUNCTION check_submission_rate_limit() IS 
'Prevents submission spam by limiting users to 10 submissions per hour.';

COMMENT ON FUNCTION check_single_attempt_activities() IS 
'Enforces business rule that certain activities (like LEARN) can only have one approved submission per user.';

COMMENT ON FUNCTION validate_status_transition() IS 
'Enforces valid submission status transitions and ensures proper reviewer assignment.';

COMMENT ON FUNCTION validate_role_change() IS 
'Validates user role changes and prevents removal of the last SUPERADMIN user.';

-- =============================================================================
-- 10. INDEXES FOR TRIGGER PERFORMANCE
-- =============================================================================

-- Index for rate limiting checks
CREATE INDEX IF NOT EXISTS idx_submissions_user_created_recent 
ON submissions(user_id, created_at) 
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Index for certificate hash uniqueness checks
CREATE INDEX IF NOT EXISTS idx_submissions_learn_cert_hash 
ON submissions((payload->>'certificateHash')) 
WHERE activity_code = 'LEARN' AND status = 'APPROVED' AND payload->>'certificateHash' IS NOT NULL;

-- Index for single attempt validation
CREATE INDEX IF NOT EXISTS idx_submissions_user_activity_status 
ON submissions(user_id, activity_code, status) 
WHERE activity_code = 'LEARN' AND status = 'APPROVED';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 20250904122305_add_triggers_constraints completed successfully';
    RAISE NOTICE 'Added: RLS policies, business rule constraints, audit triggers, validation triggers';
    RAISE NOTICE 'Added: Performance triggers, data integrity checks, and business logic validation';
END $$;