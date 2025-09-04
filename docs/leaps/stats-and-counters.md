# Stats and Homepage Counters (Option B)

Canonical source: `points_ledger` and `earned_badges` (not submissions) except where noted.

Principles

- Exclude STUDENT users from all public counters.
- Volume metrics requiring human review come from APPROVED submissions (AMPLIFY, PRESENT).

Counters (homepage, 5 items)

- educators_learning: COUNT(DISTINCT user_id) with LEARN activity among EDUCATOR users (via tag grants or ledger) > 0.
- peers_students_reached: sum of peersTrained + studentsTrained from APPROVED AMPLIFY submissions.
- stories_shared: count of APPROVED PRESENT submissions.
- micro_credentials: count of distinct course tag grants per user (max 2 per user). Prefer a tag‑per‑user guard/table; otherwise derive distinct (user_id, meta.tag_name) from ledger with net positive state.
- mce_certified: 0 until source decided; feature‑flag the provider.

Implementation outline

- educators_learning: distinct users from Learn tag grants (or ledger) filtered to user_type='EDUCATOR'.
- peers_students_reached: APPROVED AMPLIFY payload sums.
- stories_shared: APPROVED PRESENT count.
- micro_credentials: COUNT(\*) from tag‑per‑user grants; alternative: distinct (user_id, meta.tag_name) from ledger.

API route updates

- File: `apps/web/app/api/stats/route.ts` → enforce EDUCATOR filter and new definitions.
- Keep existing AMPLIFY and PRESENT logic.

Cache

- `Cache-Control: public, s-maxage=1800, stale-while-revalidate=60`.

Edge cases

- Duplicate Kajabi events: prevented via `external_event_id`; counts must rely on ledger not submissions.
- Backfills: micro_credentials should reflect historical ledger rows; no reprocessing needed.
- Performance: add indexes on `points_ledger(user_id, activity_code)` (exists) and filters on `external_source`.
