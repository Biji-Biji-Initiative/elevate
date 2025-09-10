-- Add region column to users for educator onboarding
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS region text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

