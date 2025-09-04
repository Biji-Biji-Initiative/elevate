-- Seed data for MS Elevate LEAPS Tracker

-- Insert activities (LEAPS stages)
INSERT INTO activities (code, name, default_points) VALUES
('LEARN', 'Learn', 20),
('EXPLORE', 'Explore', 50),
('AMPLIFY', 'Amplify', 2), -- Base points, will be multiplied by peer/student count
('PRESENT', 'Present', 20),
('SHINE', 'Shine', 0); -- Recognition only, no fixed points in MVP

-- Insert sample badges
INSERT INTO badges (code, name, description, criteria, icon_url) VALUES
('FIRST_STEPS', 'First Steps', 'Complete your first LEARN activity', '{"activities": ["LEARN"], "count": 1}', NULL),
('EXPLORER', 'Explorer', 'Complete LEARN and EXPLORE activities', '{"activities": ["LEARN", "EXPLORE"], "count": 2}', NULL),
('MENTOR', 'Mentor', 'Train at least 10 peers through AMPLIFY', '{"activity": "AMPLIFY", "min_peers": 10}', NULL),
('PRESENTER', 'Presenter', 'Complete PRESENT activity', '{"activities": ["PRESENT"], "count": 1}', NULL),
('RISING_STAR', 'Rising Star', 'Complete all LEAPS activities', '{"activities": ["LEARN", "EXPLORE", "AMPLIFY", "PRESENT", "SHINE"], "count": 5}', NULL),
('TOP_SCORER', 'Top Scorer', 'Reach 100 total points', '{"min_points": 100}', NULL),
('CONSISTENT', 'Consistent Contributor', 'Submit evidence for 3 consecutive weeks', '{"consistency_weeks": 3}', NULL);

-- Insert demo user (for development)
-- Note: In production, users will be created via Clerk webhook
INSERT INTO users (id, handle, name, email, role, school, cohort) VALUES
('demo-user-1', 'teacher_sari', 'Sari Dewi', 'sari.dewi@example.com', 'PARTICIPANT', 'SMAN 1 Jakarta', 'Cohort 2024-1'),
('demo-user-2', 'admin_user', 'Admin User', 'admin@leaps.mereka.org', 'ADMIN', NULL, NULL),
('demo-reviewer-1', 'reviewer_budi', 'Budi Santoso', 'budi.santoso@reviewer.com', 'REVIEWER', NULL, NULL);

-- Insert demo submissions (for development)
INSERT INTO submissions (id, user_id, activity_code, status, visibility, payload) VALUES
(
    'demo-sub-1',
    'demo-user-1',
    'LEARN',
    'APPROVED',
    'PUBLIC',
    '{"certificate_name": "AI Foundations for Educators", "issued_date": "2024-08-15", "provider": "Microsoft Learn"}'
),
(
    'demo-sub-2',
    'demo-user-1',
    'EXPLORE',
    'PENDING',
    'PRIVATE',
    '{"reflection": "I implemented AI-powered quiz generation in my English class. Students were engaged and participation increased by 40%.", "ai_tool": "ChatGPT", "subject": "English Language", "student_count": 25}'
);

-- Seed relational attachments for demo submissions
INSERT INTO submission_attachments (id, submission_id, path)
VALUES
  ('demo-att-1', 'demo-sub-1', 'demo-user-1/certificates/ai-foundations-cert.pdf'),
  ('demo-att-2', 'demo-sub-2', 'demo-user-1/evidence/classroom-implementation.pdf'),
  ('demo-att-3', 'demo-sub-2', 'demo-user-1/evidence/student-feedback.jpg');

-- Insert demo points ledger entries
INSERT INTO points_ledger (user_id, activity_code, source, delta_points, external_event_id) VALUES
('demo-user-1', 'LEARN', 'FORM', 20, NULL);

-- Refresh materialized views to include seed data
SELECT refresh_leaderboards();
