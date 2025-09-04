# LEAPS Points and Badges — Canonical Specification (MVP)

This document is the single source of truth for how points are awarded and badges are granted across LEAPS.

Status: MVP (aligned with current code); gaps and planned extensions are called out.

## Principles

- Counters principle: Points come from ledger; volume metrics requiring human review come from APPROVED submissions (AMPLIFY, PRESENT). Learn counters derive from ledger/badges.
- Idempotent by design: every award has a unique `external_event_id`; no overwrites, only compensating entries.

## Source of Truth

- Points: `points_ledger` (one row per award, with `activity_code`, `delta_points`, `source`, `external_event_id` for idempotency).
- Badges: `earned_badges` (`@@unique(user_id, badge_code)` guarantees idempotency).
- Submissions: `submissions` track evidence and review state for EXPLORE/AMPLIFY/PRESENT/SHINE.

## Activities and Points

### LEARN (total 20)

- Scheme: two courses × 10 points each (10 + 10).
- Event source: Kajabi webhooks when tags are added:
  - `elevate-ai-1-completed` → +10
  - `elevate-ai-2-completed` → +10
- Idempotency: `external_event_id = kajabi:<event_id>|tag:<tag_name>` (per-tag credit once per user).
- Cap: total LEARN-from-Kajabi is capped at 20 per user.
- Badge criterion (Starter): strict-by-tag — user must have both distinct Kajabi tags (ai‑1 and ai‑2). This avoids accidental unlock from non‑Kajabi sources.
- Counters (Option B): derive from ledger/badges; not from submissions.

### EXPLORE (+50)

- Trigger: participant submits evidence; admin approves.
- Points: +50 on approval (admin can adjust within guardrails via compensating entries).
- Evidence: photos/docs + reflection (min length enforced; server-validated).

### AMPLIFY (2 per peer, 1 per student)

- Trigger: participant submits attendance + counts; admin approves.
- Points: peers × 2 + students × 1; server-side rolling‑window caps enforced.
- Evidence: attendance file + counts; additional session metadata (see `docs/leaps/amplify.md`).

### PRESENT (+20)

- Trigger: participant submits LinkedIn URL + screenshot; admin approves.
- Points: +20 on approval.

### SHINE (Recognition)

- Trigger: submit policy idea; selection managed by program.
- Points: 0 (recognition badge only in MVP).

## Badges (MVP)

- LEARN Starter — unlocks when both Kajabi tags are present (strict-by-tag).
- EXPLORE In‑Class Innovator — on first EXPLORE approval.
- PRESENT Community Voice — on first PRESENT approval.
- SHINE nominee — selection-based.
- Implementation: badge grants after award events (webhook processing or admin approval) with idempotent `earned_badges` insert.

## Award Triggers and Pathways

- Webhook (Kajabi → LEARN): adds points directly (source='WEBHOOK'); no submissions required for counters.
- Form → Admin Review (EXPLORE/AMPLIFY/PRESENT/SHINE): points added at approval (source='MANUAL'; `external_event_id = submission:<id>:approved:v1`). Edits use compensating entries.

## Idempotency, Corrections, and Safety

- Every award writes a unique `external_event_id`.
- Corrections: never edit an existing ledger row; add a compensating negative entry with reason.
- Badge revocation: only non‑sticky badges are revoked if criteria no longer satisfied; LEARN Starter is sticky once earned by tags.

## QA Checklist

- Kajabi: each tag → +10; both tags present → Starter badge; replays do not double‑credit.
- Admin approvals: EXPLORE/AMPLIFY/PRESENT write ledger rows with deterministic event ids.
- AMPLIFY caps: approval rejected with clear errors if rolling window exceeded.
- Leaderboard: sums from `points_ledger` match expected totals.
- Stats: Learn counters from ledger/badges; AMPLIFY/PRESENT from APPROVED submissions.

## References

- Scoring logic: `packages/logic/src/scoring.ts`
- Webhook (Kajabi → LEARN): `apps/web/app/api/kajabi/webhook/route.ts`
- AMPLIFY spec: `docs/leaps/amplify.md`
- Stats mapping: `docs/leaps/stats-and-counters.md`
- Badges spec: `docs/leaps/badges.md`
- Program proposal: `plan/` documents
