# Schema & Index Deltas (for migration)

Points ledger (idempotency + speed)

- Require `event_time timestamptz` and `meta jsonb default '{}'`.
- Unique index on `external_event_id` when not null.
- Indexes: `(user_id, activity_code)`, `(activity_code, external_source, event_time)`.

Kajabi tag-per-user uniqueness

- Option A table: `learn_tag_grants(user_id, tag_name, granted_at)` with UNIQUE(user_id, tag_name).
- Option B derived uniqueness via ledger meta (distinct (user_id, meta.tag_name)).

Submissions (caps)

- Index `(user_id, activity_code, status, session_date)`.

Earned badges

- Unique `(user_id, badge_code)`.

Kajabi events

- Unique `(event_id, tag_name)`; index `(status, created_at_utc)`.

Notes

- Ensure all automated awards set `external_event_id`.
- Manual adjustments use namespaced ids (e.g., `manual:admin:<id>:<ts>`).

