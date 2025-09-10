-- Schools lookup table for onboarding autocomplete
-- Requires citext for case-insensitive uniqueness
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name citext UNIQUE NOT NULL,
  city text NULL,
  province text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive search index
CREATE INDEX IF NOT EXISTS idx_schools_name_trgm ON schools USING gin (name gin_trgm_ops);

