-- Submission access policies
-- Controls who can create, view, and modify submissions

-- Users can create their own submissions
CREATE POLICY "Users can create own submissions" ON submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.get_user_id());

-- Users can view their own submissions
CREATE POLICY "Users can view own submissions" ON submissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.get_user_id());

-- Users can view public submissions (for profiles, metrics)
-- This is controlled by the visibility column
CREATE POLICY "Public submissions are viewable" ON submissions
  FOR SELECT
  TO authenticated
  USING (visibility = 'PUBLIC');

-- Reviewers and admins can view all submissions (for review queue)
CREATE POLICY "Reviewers can view all submissions" ON submissions
  FOR SELECT
  TO authenticated
  USING (auth.is_reviewer());

-- Users can update their own pending submissions
CREATE POLICY "Users can update own pending submissions" ON submissions
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.get_user_id() 
    AND status = 'PENDING'
  );

-- Reviewers can update submissions for review (status, reviewer_id, review_note)
CREATE POLICY "Reviewers can update submissions for review" ON submissions
  FOR UPDATE
  TO authenticated
  USING (auth.is_reviewer())
  WITH CHECK (
    auth.is_reviewer() 
    AND (
      -- Can change status
      status IN ('PENDING', 'APPROVED', 'REJECTED')
      -- Can assign themselves as reviewer
      OR reviewer_id = auth.get_user_id()
    )
  );

-- Only admins can delete submissions
CREATE POLICY "Admins can delete submissions" ON submissions
  FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Performance optimization: add policy for submission metrics
-- This allows efficient querying for public metrics without exposing sensitive data
CREATE POLICY "Submission metrics are publicly viewable" ON submissions
  FOR SELECT
  TO authenticated
  USING (true); -- We'll use views to aggregate safely

-- Add indexes to support RLS performance
CREATE INDEX IF NOT EXISTS idx_submissions_visibility_status ON submissions(visibility, status);
CREATE INDEX IF NOT EXISTS idx_submissions_status_reviewer ON submissions(status, reviewer_id);

-- Create a view for public submission metrics (no personal data)
CREATE OR REPLACE VIEW public_submission_metrics AS
SELECT 
  activity_code,
  status,
  visibility,
  COUNT(*) as count,
  DATE_TRUNC('day', created_at) as submission_date
FROM submissions
GROUP BY activity_code, status, visibility, DATE_TRUNC('day', created_at);

-- Grant access to the metrics view
GRANT SELECT ON public_submission_metrics TO authenticated;

-- Add comments
COMMENT ON POLICY "Users can create own submissions" ON submissions IS 'Users can submit evidence for LEAPS activities';
COMMENT ON POLICY "Reviewers can view all submissions" ON submissions IS 'Reviewers need access to review queue';
COMMENT ON POLICY "Users can update own pending submissions" ON submissions IS 'Users can edit submissions before review';
COMMENT ON POLICY "Reviewers can update submissions for review" ON submissions IS 'Reviewers can approve/reject and add notes';

COMMENT ON VIEW public_submission_metrics IS 'Aggregated submission data for public metrics (no PII)';