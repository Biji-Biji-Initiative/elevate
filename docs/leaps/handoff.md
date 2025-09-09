# LEAPS Implementation Handoff

This document summarizes the current state of the LEAPS integration as of this commit and provides guidance for the next engineer.

## Overview

The repository now contains a substantial portion of the LEAPS points-and-badges system. Major schemas, services, API routes, and tests have been introduced across the monorepo. Agent-tracker entries show most workstreams at **PASS**, with Ops & Reliability and Activity Canon still **FAIL**.

## Completed Workstreams

### Schema & Data Layer
- `points_ledger` gains `event_time` and `meta` columns with a unique `external_event_id` index.
- New tables: `learn_tag_grants` and `kajabi_events`; `earned_badges` is unique on `(user_id, badge_code)`.
- `users` table includes `user_type` enum; migrations enable `citext` and required indexes.

### Kajabi → Learn Webhook
- Validates HMAC or shared-secret within a 5‑minute skew window.
- Normalizes tags, persists unmatched events, and enforces idempotent ledger inserts (`kajabi:<event_id>|tag:<tag>`).
- Blocks STUDENT users with an auth envelope.
- Invokes `grantBadgesForUser` on successful tag grants.

### AMPLIFY Approval Flow
- `approveAmplifySubmission` enforces per‑user advisory locks, 7‑day caps in org timezone, duplicate-session warnings, and ledger writes using `submission:<id>:approved:v1` ids.
- `approval_org_timezone` persisted.

### Submission FSM & Revocations
- Submissions support immutable `REVOKED` state via `revokeSubmission` helper that writes compensating ledger entries and re‑evaluates badges.

### Badge Engine
- `grantBadgesForUser` issues Starter (strict-by-tag), In‑Class Innovator (first APPROVED EXPLORE), and Community Voice (first APPROVED PRESENT) badges. Shine Nominee remains admin‑assignable.

### Stats Endpoint (Option B)
- `/api/stats` recomputes counters from `points_ledger`, `earn_badges`, and approved submissions, filtering `user_type='EDUCATOR'` with proper cache headers.
- Uses shared `ErrorEnvelope` for error handling.

### Identity & Referrals
- `user_type` mirrored to Clerk `publicMetadata` on upserts.
- Submission route blocks STUDENT accounts; referral helper rejects self/circular referrals.

### OpenAPI & Errors
- Introduced standardized `ErrorEnvelope` schema and regenerated OpenAPI SDK (still awaiting clean build).

## Testing & Known Issues

| Area | Result | Notes |
|------|--------|-------|
| `pnpm db:generate` | ✅ | Prisma schema compiles |
| `pnpm -F @elevate/db lint` | ✅ | Lint checks passed |
| `pnpm test:db` | ❌ | Fails: missing `TEST_DATABASE_URL` and module `@elevate/types/errors` |
| `pnpm -F web lint` | ❌ (historical) | Cannot resolve `@elevate/openapi/sdk`; ~139 errors |
| `pnpm -F web test` | ⚠️ | Some spec files fail to resolve `@elevate/logic` |
| `pnpm -F @elevate/types test` | ❌ | Missing modules (`../src/query-schemas`, `../src/common`) and assertion failures |
| `pnpm -F @elevate/openapi build` | ❌ | API extractor internal error |

## Outstanding Work

1. **Ops & Reliability**
   - Implement storage hardening (private bucket, AV scan, signed URLs, retention policy).
   - Add route rate limits and reviewer UI CSP.
   - Ensure indexed query shapes and observability hooks.

2. **Activity Canon**
   - Centralize activity codes, point rules, and badge linkage per `docs/leaps/activity-canon.md`.

3. **Stabilize CI**
   - Resolve `@elevate/openapi/sdk` path issues affecting web lint/tests.
   - Fix `@elevate/types` test suite imports (`../src/query-schemas`, etc.).
   - Provide `@elevate/types/errors` module or adjust imports so `test:db` passes.
   - Address API extractor build failure in `@elevate/openapi`.

4. **Verify Badge/Cap Edge Cases**
   - Additional tests for idempotency, cap windows around midnight, and org timezone changes (see `docs/leaps/tests.md`).

5. **Migration Playbook & Backfill**
   - Backfill `learn_tag_grants` from historical ledger and complete steps 4–7 in `docs/leaps/migration-playbook.md`.

## Integration Notes
- Ledger entries are insert‑only; revocations use compensating rows.
- All award writes should include deterministic `external_event_id` for idempotency.
- Public counters must always exclude current STUDENT accounts at read time.
- Badge grants are sticky; no automatic revokes on tag removal.

## Recommended Next Steps for New Engineer
1. Fix failing tests and lint errors, especially for `@elevate/types`, `web`, and `@elevate/openapi`.
2. Implement Ops & Reliability tasks (storage policies, rate limits, monitoring).
3. Build out the Activity Canon as the single source of truth for codes and point rules.
4. Ensure OpenAPI SDK builds cleanly and publish updated package.
5. Complete migration playbook and verify counters parity.

---
Last updated: 2025-09-09T04:31Z
