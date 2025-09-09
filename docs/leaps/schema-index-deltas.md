# Schema & Index Deltas (Augmented)

## Extensions

- Enable citext for case-insensitive tag handling

```sql
CREATE EXTENSION IF NOT EXISTS citext;
```

## points_ledger

- Add event_time and meta; idempotency and query indexes

```sql
ALTER TABLE points_ledger
  ADD COLUMN IF NOT EXISTS event_time timestamptz NOT NULL,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS ux_points_ledger_external_event_id
  ON points_ledger ((NULLIF(external_event_id, '')))
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_points_ledger_user_activity
  ON points_ledger (user_id, activity_code);

CREATE INDEX IF NOT EXISTS ix_points_ledger_activity_source_time
  ON points_ledger (activity_code, external_source, event_time);
```

## learn_tag_grants (Option A preferred)

```sql
CREATE TABLE IF NOT EXISTS learn_tag_grants (
  user_id uuid NOT NULL,
  tag_name citext NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag_name)
);
```

## kajabi_events

```sql
CREATE TABLE IF NOT EXISTS kajabi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  tag_name_raw text NOT NULL,
  tag_name_norm citext NOT NULL,
  contact_id text NOT NULL,
  email text,
  created_at_utc timestamptz NOT NULL,
  status text NOT NULL,
  raw jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_kajabi_event_tag
  ON kajabi_events (event_id, tag_name_norm);

CREATE INDEX IF NOT EXISTS ix_kajabi_events_status_time
  ON kajabi_events (status, created_at_utc);
```

## earned_badges

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ux_earned_badges_user_code
  ON earned_badges (user_id, badge_code);
```
