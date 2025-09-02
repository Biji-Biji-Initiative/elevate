# Elevate Indonesia — Monorepo (Scaffold)

This repository contains a scaffold aligning with LEAPS (Learn, Explore, Amplify, Present, Shine) and the FY2026 proposal.

Structure
- `apps/web`: Public site + participant dashboard (Next.js)
- `apps/admin`: Reviewer/Admin console (Next.js)
- `packages/db`: Prisma schema + client + seed
- `packages/types`: Zod schemas for stage forms
- `packages/auth`: RBAC helper for Clerk roles
- `infra/supabase`: SQL views/materialized views for leaderboards and metrics
- `docs`: OpenAPI draft and schema notes

Getting Started (after dependencies are installed)
- Copy `.env.example` in `apps/web` and `apps/admin` to `.env.local` and set values.
- Install dependencies at the repo root and in apps.
- Run `npm run db:generate` to generate Prisma client.
- Apply schema to your database and run the SQL in `infra/supabase/migrations/001_views.sql`.
- Seed: `npm run db:seed` with optional `SEED_ADMIN_*` variables.

Notes
- This scaffold avoids network operations in this environment; no packages are installed.
- Public metrics and leaderboard show aggregates; PII stays behind auth.
