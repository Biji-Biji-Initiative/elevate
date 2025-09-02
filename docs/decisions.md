# Decisions Log (ADR-lite)

- 0001 — API surface: Use Next.js Route Handlers in `apps/web` for MVP; can be split into standalone Fastify service later without schema changes.
- 0002 — Scoring: Follow LEAPS points from deck (Learn 20, Explore 50, Amplify 2/peer+1/student, Present 20; Shine badge). Caps TBD.
- 0003 — Auth: Clerk (Google only) for MVP; roles via publicMetadata (participant, reviewer, admin, superadmin).
- 0004 — Storage: Supabase Storage; keep evidence private; only approved+public appear on profile.
- 0005 — Leaderboard: append-only `points_ledger`; total via MVs; refresh on approval.
- 0006 — Privacy: Public metrics aggregate only; PII behind auth; public profile opt-in per submission.
- 0007 — Badges awarding: Actions earn points; badges are awarded automatically when stage completion or point thresholds are met. Badges are cosmetic (no extra points).

Open Decisions
- D007 — Amplify caps per period and evidence requirements.
- D008 — Badge thresholds (points or stage completion conditions).
- D009 — Localization scope (Bahasa + English) and copy source ownership.
- D010 — Linear gating between levels/stages, if any.
