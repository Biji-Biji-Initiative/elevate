---
title: Ops Guide — Rate Limits & Internal Endpoints
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [ops, limits, endpoints]
---

Rate Limits
- Public endpoints are wrapped with `withRateLimit(publicApiRateLimiter)` as appropriate: `/api/leaderboard`, `/api/profile/[handle]`, `/api/stats`, `/api/logs/client-errors`, `/api/csp-report`.
- Adjust policies in `@elevate/security` (e.g., burst/window) and redeploy.

Internal SLO Endpoint
- Enable via `ENABLE_INTERNAL_ENDPOINTS=1` and protect access using `INTERNAL_METRICS_TOKEN`.
- Requests must include `Authorization: Bearer <token>` or receive 401; returns 404 when disabled.

Evidence Dedupe (LEARN)
- Route-level check prevents duplicate LEARN certificate submissions when `certificate_hash` is present.
- DB indexes support both legacy (`certificateHash`) and canonical snake_case (`certificate_hash`) JSON paths.

