-- Enforce one active LEARN submission (PENDING or APPROVED) per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_learn_active_submission
ON submissions (user_id)
WHERE activity_code = 'LEARN' AND status IN ('PENDING', 'APPROVED');

-- Ensure external_event_id remains unique (redundant with Prisma but explicit here)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_points_external_event
ON points_ledger ((COALESCE(external_event_id, '')))
WHERE external_event_id IS NOT NULL;
