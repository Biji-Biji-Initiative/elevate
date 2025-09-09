-- LEAPS follow-up: enforce NOT NULL and add performance index

-- Ensure points_ledger.event_time is NOT NULL after backfill
ALTER TABLE points_ledger
  ALTER COLUMN event_time SET NOT NULL;

-- Optional performance index to speed Kajabi user matching by email when contact_id known
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_users_email_kajabi'
  ) THEN
    CREATE INDEX idx_users_email_kajabi ON users(LOWER(email)) WHERE kajabi_contact_id IS NOT NULL;
  END IF;
END$$;

