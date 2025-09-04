# North‑Star Invariants

These invariants guide design and reviews. Treat them like conservation laws.

1. Ledger immutability: no updates/deletes; only inserts. Corrections are compensations (negative deltas allowed).
2. Single‑fire events: any `external_event_id` produces at most one ledger insert (idempotent).
3. Event‑time first: caps/analytics use event time (session date or webhook created_at), not processing time.
4. Deterministic provenance: every ledger row records `external_source`, `external_event_id`, and optional `submission_id`.
5. Unique badges: `@@unique(user_id, badge_code)`; re‑evaluate after any award/compensation.
6. Reproducible counters: public counters recompute from authoritative sources; no hidden side effects.
7. No PII on public surfaces: only aggregates leave the server.
8. Safe replay: reprocessing any event never inflates points or duplicates badges.

