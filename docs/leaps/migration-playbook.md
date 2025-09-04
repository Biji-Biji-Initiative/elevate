# Migration Playbook — Safe Rollout

Phases

1. Prepare (docs + config)

- Land docs; decide strict-by-tag and tag-per-user approach
- Add config toggles (`docs/leaps/config.md`)

2. Schema

- Apply indexes and new tables per `schema-index-deltas.md`
- Migrate with zero-downtime strategy (CONCURRENTLY indexes, additive columns)

3. Feature flags

- Gate: `learnStarter.mode`, `org.timezone`, `amplifyCaps`, `duplicateWindowMinutes`

4. Backfill (if using tag-per-user grants)

- Extract distinct (user_id, tag_name) from ledger meta
- Dry-run CSV; sample review; supervised apply

5. Code paths switch

- Switch /api/stats to Option B definitions (educator filter, tag grants)
- Ensure webhook uses tag-per-user guard before ledger write

6. Rollback plan

- Schema: keep additive; roll forward preferred
- Behavior: flip flags to previous behavior (e.g., source_points for Starter)

7. Post-verify

- Counters parity vs fixtures; badge counts stable; unmatched queue within SLA

