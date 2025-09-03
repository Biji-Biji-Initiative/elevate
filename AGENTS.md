Microsoft Elevate Indonesia — AGENT Handbook

Purpose
- Align on scope, constraints, and ways-of-working before implementation.
- Keep decisions explicit and reversible; avoid premature building.

What We’re Building (Understanding)
- Public site for Elevate Indonesia that explains the LEAPS journey and invites educators to join.
- Participant dashboard + forms to submit evidence for LEAPS: Learn (20), Explore (50), Amplify (2/peer, 1/student), Present (20), Shine (recognition).
- Leaderboard to rank top educators by points; public metrics pages with aggregate counts (no PII).
- Admin console to review/approve evidence, award points, reconcile integrations (Kajabi), and export data.

Key Inputs Read
- Microsoft Elevaite Indonesia - FY2026.pdf: program narrative, LEAPS stages, scoring, flow, targets, and open questions.
- about.md: productized IA (pages), MVP acceptance criteria, and integration constraints.
- plan.md: translated proposal into deliverable milestones and target architecture.

Tech & Integrations (from brief)
- Frontend: Next.js + shadcn/ui + React Hook Form + zod.
- Auth: Clerk (Google only) for MVP.
- Data: Supabase Postgres via Prisma; Supabase Storage for uploads.
- Integrations: Kajabi webhook for Learn auto-credit where possible; LinkedIn has no API → require URL + screenshot.
- Metrics & Leaderboard: public aggregate reads; PII behind auth.

Data Model (draft synthesis)
- Educator(id, email, name, school, district, roles, created_at)
- Submission(id, educator_id, stage[learn|explore|amplify|present|shine], payload JSON, visibility[private|public], status[pending|approved|rejected], points_awarded, created_at, reviewed_at)
- AmplifyStats(peers_count, students_count) captured inside Submission.payload for amplify
- Badge(id, key, name, thresholds)
- LeaderboardSnapshot(period, data JSON)

Scoring Rules (MVP)
- Learn: +20 when approved (one qualifying certificate per educator).
- Explore: +50 when approved.
- Amplify: 2 points per peer, 1 per student; optional caps TBD (e.g., 100 peers, 500 students per educator/month).
- Present: +20 when LinkedIn URL + screenshot approved.
- Shine: badge flag; optional bonus points subject to program decision.

Information Architecture (short)
- Public: /, /leaderboard, /metrics/[stage], /u/[handle]
- Participant: /dashboard, /dashboard/[stage]
- Admin: /admin/* (queues, users, exports, Kajabi reconciliation)

MVP Acceptance Criteria (from brief)
- Clear homepage with single CTA; copy aligns with deck.
- Dashboard shows five stages, points, badges; forms functional; history visible.
- Public profile shows only approved+public items.
- Leaderboard shows Top‑20, updates within ~1 minute of approvals.
- Kajabi webhook credits Learn via email match or routes to Admin queue.
- RBAC: participant, reviewer, admin; actions logged.

Open Questions to Resolve
- Localization: Bahasa Indonesia coverage and copy sources.
- Linear levels: is Level 2 gated by Level 1 completion?
- 21CLD: scope limited to knowledge transfer or through MCE certification? Duration flexibility?
- Amplify caps: per-period limits to prevent gaming; evidence format requirements.
- Shine criteria: selection mechanism and any bonus points.
- Data retention, privacy policy, and public profile defaults.

Working Agreements
- No implementation without explicit “go” from the user; prioritize clarity and planning.
- Use the plan tool to track steps; exactly one step in progress at any time.
- Keep changes minimal, focused, and documented in this file and plan.md.
- Prefer small, verifiable increments; validate locally where possible.
- Avoid adding dependencies or making networked calls without approval.
- Do not commit; the user will handle VCS unless asked.

Delivery Phases (proposed)
1) Planning & Specs
   - Confirm scoring, caps, and public defaults; finalize OpenAPI and schema.
2) MVP App Skeleton
   - Next.js app with pages and forms wired to a local mock API.
3) Backend & DB
   - Node/Fastify or Next API routes + Prisma + Supabase schema; file uploads to storage.
4) Admin & Review
   - Moderation queue, approvals, points awarding, exports.
5) Public Profiles & Metrics
   - Leaderboard and aggregate counters; privacy constraints.
6) Integrations
   - Kajabi webhook + reconciliation.
7) Hardening & Deploy
   - RBAC, logs, rate limits, staging rollout.

Tooling & Ops
- Lint/format: use project defaults if present; otherwise keep style consistent.
- Tests: add focused tests where a test suite exists; avoid unrelated fixes.
- CI/CD: to be defined after stack confirmation.

Next Actions (awaiting approval)
- Confirm scope: MVP pages, scoring caps, localization.
- Produce OpenAPI draft and SQL schema under /docs.
- Prepare Next.js app scaffold (no deployment, no integrations) for review.
Build & Lint Rules (must follow)
- Read elevate/BUILDING.md and adhere to the solution-style TS + two-stage build, dist-only exports, and server/client boundaries.
- Do not modify build scripts to inline entries; use tsup.config.ts entries only.
- Keep libraries (packages/*) type-safe with strict ESLint; apps use progressive hardening during migration (see BUILDING.md).
