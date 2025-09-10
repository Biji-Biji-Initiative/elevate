-- Referral support: user columns and events table

-- Add referral columns to users
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_code text UNIQUE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Create referral_events table
CREATE TABLE IF NOT EXISTS referral_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  external_event_id text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency on referrer/referee/event_type
CREATE UNIQUE INDEX IF NOT EXISTS ux_referral_event_pair_event
  ON referral_events(referrer_user_id, referee_user_id, event_type);

CREATE INDEX IF NOT EXISTS ix_referrals_referrer_time
  ON referral_events(referrer_user_id, created_at);

