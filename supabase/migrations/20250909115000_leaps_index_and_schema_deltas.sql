-- LEAPS schema/index deltas aligned with docs/leaps/schema-index-deltas.md
-- This migration is additive and non-destructive.

-- Extensions
CREATE EXTENSION IF NOT EXISTS citext;

-- points_ledger: add event_time and meta; idempotency and query indexes
ALTER TABLE points_ledger
  ADD COLUMN IF NOT EXISTS event_time timestamptz,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill event_time from created_at if null (safe default)
UPDATE points_ledger SET event_time = created_at WHERE event_time IS NULL;

-- Idempotency index on external_event_id when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'ux_points_ledger_external_event_id'
  ) THEN
    CREATE UNIQUE INDEX ux_points_ledger_external_event_id
      ON points_ledger ((NULLIF(external_event_id, '')))
      WHERE external_event_id IS NOT NULL;
  END IF;
END$$;

-- Query indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'ix_points_ledger_user_activity'
  ) THEN
    CREATE INDEX ix_points_ledger_user_activity
      ON points_ledger (user_id, activity_code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'ix_points_ledger_activity_source_time'
  ) THEN
    CREATE INDEX ix_points_ledger_activity_source_time
      ON points_ledger (activity_code, external_source, event_time);
  END IF;
END$$;

-- learn_tag_grants (Option A)
CREATE TABLE IF NOT EXISTS learn_tag_grants (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_name citext NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag_name)
);

-- kajabi_events: ensure new fields and indexes exist (non-destructive)
ALTER TABLE kajabi_events
  ADD COLUMN IF NOT EXISTS event_id text,
  ADD COLUMN IF NOT EXISTS tag_name_raw text,
  ADD COLUMN IF NOT EXISTS tag_name_norm citext,
  ADD COLUMN IF NOT EXISTS contact_id text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS created_at_utc timestamptz,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS raw jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'ux_kajabi_event_tag'
  ) THEN
    CREATE UNIQUE INDEX ux_kajabi_event_tag
      ON kajabi_events (event_id, tag_name_norm);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'ix_kajabi_events_status_time'
  ) THEN
    CREATE INDEX ix_kajabi_events_status_time
      ON kajabi_events (status, created_at_utc);
  END IF;
END$$;

-- earned_badges: unique index (if not already enforced by constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'ux_earned_badges_user_code'
  ) THEN
    CREATE UNIQUE INDEX ux_earned_badges_user_code
      ON earned_badges (user_id, badge_code);
  END IF;
END$$;

-- submissions: approval_org_timezone (nullable)
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS approval_org_timezone text;

