# LEAPS Agent Execution Tracker (Conformance Checklist)

Objective: Ensure code matches LEAPS specs. No feature creep; only verify and correct drift.

## Quick Outcome Template

- Summary: PASS | PARTIAL | FAIL
- Notes:
- Follow‑ups:

## Checks (PASS/FAIL per item)

1. Stats and Counters (Option B)

- [ ] /api/stats derives Learn counters from ledger/badges, not submissions
- [ ] peers_students_reached = sum from APPROVED AMPLIFY submissions (payload peers+students)
- [ ] stories_shared = APPROVED PRESENT count
- [ ] Cache headers: public, s-maxage=1800 (and optional stale-while-revalidate)
- [ ] Principle pinned: points from ledger; volume from APPROVED submissions
- [ ] Excludes user_type='STUDENT' from all public counters

Files: `apps/web/app/api/stats/route.ts`, `docs/leaps/stats-and-counters.md`, `docs/points-and-badges.md`

2. Kajabi → LEARN (10+10, cap 20, strict-by-tag)

- [ ] Webhook authenticates (secret or HMAC + timestamp window)
- [ ] Idempotency key: `kajabi:<event_id>|tag:<tag_name>`
- [ ] Tag-per-user uniqueness (user_id, tag_name) enforced
- [ ] Ledger inserts +10 per distinct tag; cap total LEARN at 20
- [ ] Starter badge unlocks only when both tags present (strict-by-tag)
- [ ] Unmatched events persisted and reconcilable; contactId binding present

Files: `apps/web/app/api/kajabi/webhook/route.ts`, `packages/db/schema.prisma`, `docs/leaps/kajabi-learn.md`, `docs/points-and-badges.md`

3. AMPLIFY intake, caps, anti-gaming

- [ ] Payload includes: sessionDate, sessionStartTime, durationMinutes, location {venue/city/country}, sessionTitle?, coFacilitators?, evidenceNote?
- [ ] Server validation enforces per-submission caps and 7‑day rolling caps by sessionDate in org TZ
- [ ] Advisory transaction lock used for approval; recheck caps under lock
- [ ] Duplicate-session soft flag implemented; null city handled gracefully

Files: `packages/types/src/submission-payloads.api.ts`, validators, `docs/leaps/amplify.md`

4. Submissions FSM and ledger invariants

- [ ] FSM states/transitions implemented: DRAFT → SUBMITTED → {APPROVED|REJECTED}; APPROVED → REVOKED (admin)
- [ ] Approvals write ledger with `external_event_id=submission:<id>:approved:v1`
- [ ] Corrections/Revokes use compensating entries with deterministic ids
- [ ] Badge revocation policy (sticky table) followed

Files: `docs/leaps/submissions-fsm.md`, approval routes, `packages/db/schema.prisma`

5. Badges

- [ ] `earned_badges` unique (user_id, badge_code)
- [ ] `grantBadgesForUser(userId)` exists and runs post-award in transaction with retry on unique conflict
- [ ] Starter rule consistent across docs (strict-by-tag)

Files: `packages/logic/src/scoring.ts`, `docs/leaps/badges.md`, `packages/db/schema.prisma`

6. Identity & referrals

- [ ] `users.user_type` enum (EDUCATOR|STUDENT) persisted and mirrored to Clerk publicMetadata
- [ ] Students cannot submit or appear on leaderboard; LEARN awards blocked for STUDENT
- [ ] Referral anti‑gaming: self/circular blocked; IP/device/domain checks documented

Files: `packages/db/schema.prisma`, Clerk hooks/middleware, `docs/leaps/identity-and-referrals.md`

7. Ops & reliability

- [ ] Evidence storage policy: private bucket, signed URLs, AV scan, retention; safe serving headers and allow‑list
- [ ] Indexes present for documented query shapes
- [ ] Observability: logs fields and SLOs in place

Files: `docs/leaps/ops-and-reliability.md`, storage utils, schema indexes

8. OpenAPI and errors (Vitest only)

- [ ] Error envelope `{ type, code, message, details[] }` and examples
- [ ] SDK regenerated if spec changed; semver noted

Files: `packages/openapi/src/spec.ts`, `packages/openapi/src/sdk.ts`, `docs/leaps/errors-and-openapi.md`

9. Activity Canon

- [ ] Single source of truth for activity codes, sources, point rules, and badge linkage

Files: `docs/leaps/activity-canon.md`

## PASS/FAIL Table (fill this)

| Check              | Result | Notes |
| ------------------ | ------ | ----- |
| Stats Option B     |        |       |
| Kajabi 10+10       |        |       |
| AMPLIFY caps       |        |       |
| FSM & Ledger       |        |       |
| Badges             |        |       |
| Identity/Referrals |        |       |
| Ops & Reliability  |        |       |
| OpenAPI/Errors     |        |       |
| Activity Canon     |        |       |

## How to use

- Fill PASS/FAIL, link diffs, create small PRs to fix drift.
- Do not add new features—only match docs.
- Keep this file updated as acceptance criteria.
