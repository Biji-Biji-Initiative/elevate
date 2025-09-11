---
title: LEAPS Activity Canon (Authoritative)
owner: platform-team
status: active
last_reviewed: 2025-09-11
tags: [leaps, scoring, canon]
---

# LEAPS Activity Canon

Authoritative, implementation-aligned rules for points and badges across LEAPS. These mirror `packages/types/src/activity-canon.ts` and referral logic in the web app.

## Activities and Points

- LEARN:
  - +10 per Learn completion tag; two-course model.
  - Cap 20 total per user for LEARN.
  - Source: Kajabi webhooks (`/api/kajabi/webhook`) — Option B (no submissions).

- EXPLORE:
  - +50 on first approved EXPLORE submission.

- PRESENT:
  - +20 on first approved PRESENT submission.

- AMPLIFY:
  - 2 points per peer trained; 1 point per student trained.
  - Weekly caps: 50 (peers), 200 (students) applied in computation.

## Referrals (Educators Only Earn)

- Eligibility: Only Educator referrers earn referral points.
- Award on signup (idempotent per referee):
  - Invitee is Educator → +2 points to referrer.
  - Invitee is Student → +1 point to referrer.
- Monthly cap: 50 referral points per referrer (resets monthly, UTC).
- Ledger: Recorded under `activity_code='AMPLIFY'`, `external_source='referral'`, `external_event_id='referral:signup:<refereeId>'`.

## Badges

- STARTER:
  - Awarded when both Learn tags are present (`elevate-ai-1-completed`, `elevate-ai-2-completed`).
  - Granted automatically after Learn tag grants.

- IN_CLASS_INNOVATOR:
  - First approved EXPLORE submission.

- COMMUNITY_VOICE:
  - First approved PRESENT submission.

## Learn Tags (Kajabi)

- Default tags (configurable via `KAJABI_LEARN_TAGS`):
  - `elevate-ai-1-completed`
  - `elevate-ai-2-completed`

## Implementation Sources

- Types Canon: `packages/types/src/activity-canon.ts`
- Webhook Handler: `apps/web/app/api/kajabi/webhook/route.ts`
- Badges Grant: `packages/logic/src/scoring.ts#grantBadgesForUser`
- Referrals: `apps/web/app/api/dashboard/route.ts` (cookie attribution) and `referral_events` table

## Counters Strategy (Option B)

- Counters and dashboard totals derive from `points_ledger` and `earned_badges`.
- LEARN completion is inferred from Learn Tag Grants, not submissions.
