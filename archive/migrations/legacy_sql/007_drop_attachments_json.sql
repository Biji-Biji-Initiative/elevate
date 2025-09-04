-- Drop deprecated JSON attachments column from submissions
-- Ensure all consumers use relational submission_attachments as canonical

ALTER TABLE "submissions"
  DROP COLUMN IF EXISTS "attachments";

