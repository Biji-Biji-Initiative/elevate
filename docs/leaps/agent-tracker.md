# LEAPS Agent Execution Tracker (Conformance Checklist)

Objective: Ensure code matches LEAPS specs. No feature creep; only verify and correct drift.

## Quick Outcome Template

- Summary: PARTIAL → STRONG PARTIAL
- Notes: OpenAPI extractor fixed (minimal root export). Dashboard now derives points from ledger (Option B). Ops improved (signed URLs + AV scan hook + retention helper). Activity Canon consolidation still pending. SLOs added to /api/stats.
- Follow‑ups: Implement remaining Ops hardening (real AV, job for retention), finalize Activity Canon as single source of truth. Extend SLO instrumentation to more routes.

## Checks (PASS/FAIL per item)

1. Stats and Counters (Option B)

- [x] /api/stats derives Learn counters from ledger/badges, not submissions
- [x] peers_students_reached = sum from APPROVED AMPLIFY submissions (payload peers+students)
- [x] stories_shared = APPROVED PRESENT count
- [x] Cache headers: public, s-maxage=1800 (and optional stale-while-revalidate)
- [x] Principle pinned: points from ledger; volume from APPROVED submissions
- [x] Excludes user_type='STUDENT' from all public counters
- [x] Error responses reuse shared ErrorEnvelope contract

Files: `apps/web/app/api/stats/route.ts`, `docs/leaps/stats-and-counters.md`, `docs/points-and-badges.md`

2. Kajabi → LEARN (10+10, cap 20, strict-by-tag)

- [x] Webhook authenticates (secret or HMAC + timestamp window)
- [x] Idempotency key: `kajabi:<event_id>|tag:<tag_name>`
- [x] Tag-per-user uniqueness (user_id, tag_name) enforced
- [x] Ledger inserts +10 per distinct tag; cap total LEARN at 20
- [x] Starter badge unlocks only when both tags present (strict-by-tag)
- [x] Unmatched events persisted and reconcilable; contactId binding present

Files: `apps/web/app/api/kajabi/webhook/route.ts`, `packages/db/schema.prisma`, `docs/leaps/kajabi-learn.md`, `docs/points-and-badges.md`

2a. Invitations / Enrollment (Kajabi offer grant)

- [x] On Clerk `user.created`, system creates/updates Kajabi contact, stores `kajabi_contact_id`, and grants configured offer (`KAJABI_OFFER_ID`) via API if set; audit logged.
- [x] Fallback enrollment attempt on first dashboard access for missing users (best-effort, non-blocking).
- [ ] Confirm production env vars present: `KAJABI_API_KEY`, `KAJABI_CLIENT_SECRET`, `KAJABI_OFFER_ID`.

Files: `apps/web/app/api/webhooks/clerk/route.ts`, `apps/web/app/api/dashboard/route.ts`, `packages/integrations/src/utils.ts`, `packages/integrations/src/kajabi.ts`

Admin tools

- [x] `GET /api/admin/kajabi/health` — surface connectivity/env flags
- [x] `POST /api/admin/kajabi/invite` — force enroll/grant offer by userId/email
- [x] Admin UI: Kajabi page includes health + invite controls; Storage page adds retention enforcement form

Files: `apps/admin/app/[locale]/kajabi/page.tsx`, `apps/admin/app/[locale]/storage/page.tsx`
3. AMPLIFY intake, caps, anti-gaming

- [x] Payload includes: sessionDate, sessionStartTime, durationMinutes, location {venue/city/country}, sessionTitle?, coFacilitators?, evidenceNote?
- [x] Server validation enforces per-submission caps and 7‑day rolling caps by sessionDate in org TZ
- [x] Advisory transaction lock used for approval; recheck caps under lock
- [x] Duplicate-session soft flag implemented; null city handled gracefully

Files: `packages/types/src/submission-payloads.api.ts`, validators, `docs/leaps/amplify.md`

4. Submissions FSM and ledger invariants

- [x] FSM states/transitions implemented: DRAFT → SUBMITTED → {APPROVED|REJECTED}; APPROVED → REVOKED (admin)
- [x] Approvals write ledger with `external_event_id=submission:<id>:approved:v1`
- [x] Corrections/Revokes use compensating entries with deterministic ids
- [x] Badge revocation policy (sticky table) followed

Files: `docs/leaps/submissions-fsm.md`, approval routes, `packages/db/schema.prisma`

5. Badges

- [x] `earned_badges` unique (user_id, badge_code)
- [x] `grantBadgesForUser(userId)` exists and runs post-award in transaction with retry on unique conflict
- [x] Starter rule consistent across docs (strict-by-tag)

Files: `packages/logic/src/scoring.ts`, `docs/leaps/badges.md`, `packages/db/schema.prisma`

6. Identity & referrals

- [x] `users.user_type` enum (EDUCATOR|STUDENT) persisted and mirrored to Clerk publicMetadata
- [x] Students cannot submit or appear on leaderboard; LEARN awards blocked for STUDENT
- [x] Referral anti‑gaming: self/circular blocked; IP/device/domain checks documented

Files: `packages/db/schema.prisma`, Clerk hooks/middleware, `docs/leaps/identity-and-referrals.md`

7. Ops & reliability

- [x] Evidence storage policy (initial): signed URLs (1h), server-only access, strict headers; file type allow‑list and size limits
- [x] AV scan hook (EICAR heuristic) gated by env; retention helper for evidence objects
- [ ] Integrate real AV scanner and schedule retention job; document allow‑list at infra level
- [ ] Indexes present for documented query shapes
- [ ] Observability: logs fields and SLOs in place
  - [x] SLO instrumentation added to /api/stats (availability + response time)

Files: `docs/leaps/ops-and-reliability.md`, storage utils, schema indexes

8. OpenAPI and errors (Vitest only)

- [x] Error envelope `{ type, code, message, details[] }` and examples
- [x] SDK regenerated if spec changed; semver noted

Files: `packages/openapi/src/spec.ts`, `packages/openapi/src/sdk.ts`, `docs/leaps/errors-and-openapi.md`

9. Activity Canon

- [x] Single source of truth for activity codes, sources, point rules, and badge linkage (see `badgeCanon` + `activityCanon`).

Files: `docs/leaps/activity-canon.md`, `packages/types/src/activity-canon.ts`, `packages/logic/src/scoring.ts`

## PASS/FAIL Table (fill this)

| Check                   | Result | Notes |
| ----------------------- | ------ | ----- |
| Stats Option B          | PASS   | /api/stats and dashboard derive from ledger; EDUCATOR filter enforced |
| Kajabi 10+10            | PASS   | Webhook grants tags and idempotent ledger; badges re-evaluated |
| Invitations (Kajabi)    | CONFIG | Works when KAJABI_API_KEY/CLIENT_SECRET/OFFER_ID are set; audit logged |
| AMPLIFY caps            | PASS   | `approveAmplifySubmission` enforces 7-day caps and duplicate warnings |
| FSM & Ledger            | PASS   | Revocation writes compensating ledger entries |
| Badges                  | PASS   | `grantBadgesForUser` awards Starter, Innovator, Community Voice |
| Identity/Referrals      | PASS   | user_type persisted and mirrored; referrals util guards self/circular |
| Ops & Reliability       | PARTIAL| Signed URLs, headers, AV hook, retention helper; SLOs on stats; needs real AV + job |
| OpenAPI/Errors          | PASS   | Error envelope; extractor fixed; SDK build OK |
| Activity Canon          | PASS   | activityCanon + badgeCanon define rules; logic consumes canon |

## How to use

- Fill PASS/FAIL, link diffs, create small PRs to fix drift.
- Do not add new features—only match docs.
- Keep this file updated as acceptance criteria.

## Acceptance Criteria (binary)

- Starter granted only when both normalized tags exist; replays/compensations do not double-grant.
- /api/stats filters current user_type='EDUCATOR'.
- Approving AMPLIFY with missing time does not block; reviewer warning emitted.
- Replaying same Kajabi event 100× yields exactly 1 ledger row and ≤1 badge insert.
- org.timezone changes do not retro‑alter approved cap windows.
- Deleting a user removes PII; counters unaffected.

## CI Parity Tests

- Schema drift: import `packages/types/src/submission-payloads.api.ts` and assert presence of AMPLIFY fields.
- Stats parity: seed EDU/STUDENT fixtures; assert /api/stats equals SQL sketches in docs.
- Config mode: if `learnStarter.mode='source_points'`, PR body includes incident link + rollback plan banner.
