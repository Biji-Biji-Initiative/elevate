# LEAPS System — Developer Docs (Index)

This folder is the canonical reference for LEAPS points, badges, webhooks, caps, and counters. It is sufficient for coding agents to implement features without guessing.

## Scope

- Scoring rules and triggers (Option B — ledger/badge-derived stats)
- Badge criteria and granting service (idempotent)
- Kajabi Learn integration (10+10, cap 20, security, reconciliation)
- AMPLIFY intake (peers vs students), validation, anti-gaming
- Stats and homepage counters mapping (/api/stats)

## Files

- points-and-badges.md — global rules (lives in docs root) [canonical]
- stats-and-counters.md — how to compute and serve counters (Option B)
- kajabi-learn.md — webhook contract, idempotency, badge unlock, admin reconciliation
- amplify.md — definitions, evidence, caps, server validation, reviewer guidance
- badges.md — badge catalog, criteria, grant algorithm, backfill

## Code References

- Prisma: `packages/db/schema.prisma` (User, Submission, PointsLedger, Badge, EarnedBadge, KajabiEvent)
- API Stats: `apps/web/app/api/stats/route.ts`
- Types (payloads, parsers): `packages/types/src/submission-payloads.api.ts`
- OpenAPI SDK: `packages/openapi/src/spec.ts`, `packages/openapi/src/sdk.ts`
- Logic (planned): `packages/logic/src/scoring.ts` (ensure functions referenced here exist)

## Decisions

- Learn counters source: Option B. Counters derive from `points_ledger` and `earned_badges`, not `submissions`.
- AMPLIFY counts are provided as two numbers: `peersTrained` and `studentsTrained`; CSV/JPG/PDF is evidence only and is not parsed.
- Badges are granted in the same transaction immediately after points are awarded.

## Conventions

- All award writes use `external_event_id` for idempotency.
- All server-side validations must mirror UI constraints and include explicit error messages.
- Public pages read only aggregate data; no PII.

