# Test Plan (Vitest)

Required tests

- Idempotency: replay same Kajabi event 10× → 1 ledger row; 0 duplicate badges.
- Race: two concurrent approvals crossing a badge threshold → 1 badge row (unique guard + retry).
- Cap window: sessionDate straddling TZ midnight still enforces 7‑day window.
- Compensation: revoke → negative ledger → badges re‑evaluated per sticky rules.
- Counters parity: fixtures → /api/stats equals first‑principles sums.
- Duplicate session flag: near-duplicate time/city flagged, not blocked.
- Reconciliation: unmatched Kajabi event matched later → award and (if threshold) badge.

Notes

- Prefer property tests for cap math over a sliding 30‑day window.
- Use test helpers to seed users, submissions, and ledger rows; avoid mutating existing rows (simulate compensations).

