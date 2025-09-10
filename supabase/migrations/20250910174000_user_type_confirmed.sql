-- Track explicit confirmation of user_type
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type_confirmed boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Mark existing users as confirmed to avoid forcing legacy users through onboarding
UPDATE users SET user_type_confirmed = true WHERE user_type_confirmed IS NOT TRUE;
