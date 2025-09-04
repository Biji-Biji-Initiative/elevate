# Badges — Criteria and Granting

Catalog (MVP)

- LEARN Starter — strict-by-tag: awarded only when both Kajabi course tags exist for the user (`elevate-ai-1-completed` and `elevate-ai-2-completed`). Points ≥20 alone does not grant.
- In‑Class Innovator — on first APPROVED EXPLORE submission.
- Community Voice — on first APPROVED PRESENT submission.
- Shine Nominee — program selection (admin assign).

Sticky policy

- Starter: sticky (never revoked once both tags present)
- In‑Class Innovator: sticky
- Community Voice: sticky
- Shine Nominee: sticky unless explicitly removed by admin policy

Granting algorithm

- Runs immediately after any award event (webhook or admin approval) in the same transaction where possible.
- Check criteria → insert into `earned_badges` if not already present (`@@unique(user_id, badge_code)` ensures idempotency).
- For Starter, verify presence of both tags (see Kajabi doc) or an equivalent tag‑per‑user table/index.

Implementation notes

- Provide `grantBadgesForUser(userId)` in `packages/logic/src/scoring.ts`.
- Backfill script: iterate all users; grant missing badges per rules.

Testing

- LEARN: two distinct tags → Starter; single tag or compensations → no Starter.
- EXPLORE/PRESENT: first APPROVED submission grants once; duplicates ignored.
