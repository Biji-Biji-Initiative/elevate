-- Persist org timezone used at approval time for AMPLIFY caps
ALTER TABLE submissions
  ADD COLUMN approval_org_timezone TEXT;
