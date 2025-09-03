MS Elevate — LEAPS Tracker: Master Checklist

How to use: Each task has a checkbox [ ], suggested Owner, Deliverable(s), Acceptance criteria, and Notes/Dependencies. Strike through items you decide to defer. Everything assumes: Vercel hosting, Clerk (Google SSO), Supabase (Postgres), Next.js 15 App Router, separate Admin app, and Kajabi webhook for Learn.

Owner glossary:
- PLAT = Platform/Infra
- FE = Frontend
- BE = Backend
- ADM = Admin/Reviewer lead
- DSN = Design/UX
- CNT = Content/Copy
- DA = Data/Analytics
- SEC = Security/Compliance
- PM = Product

0) Program Canon & Guardrails (source of truth)
- [ ] 0.1 Lock program canon — LEAPS stages & points confirmed per deck (p.3–4).
- [ ] 0.2 Publish anti‑gaming rules (Amplify)
- [ ] 0.3 Define MVP scope vs. v2

1) Cloud Tenancy, Identity & Domains
- [ ] 1.1 Vercel org & projects (web/admin)
- [ ] 1.2 New Google Cloud Projects (dev/prod)
- [ ] 1.3 Google OAuth clients (Web)
- [ ] 1.4 Clerk tenants (dev, prod) with Google SSO only
- [ ] 1.5 Supabase projects (dev, prod)
- [ ] 1.6 DNS & TLS

2) Repository & Tooling (Mono‑repo discipline)
- [x] 2.1 Turborepo + pnpm workspace (apps, packages, infra)
- [ ] 2.2 TypeScript/ESLint/Prettier base config
- [ ] 2.3 CODEOWNERS & branch protections
- [ ] 2.4 CI/CD (GitHub Actions)

3) Environment Management
- [x] 3.1 Secrets matrix (.env.example)
- [ ] 3.2 Runtime guard (zod env parser)

4) Data Layer (Prisma + SQL Views)
- [x] 4.1 Prisma models
- [x] 4.2 Seed activities
- [x] 4.3 Materialized views + metrics view
- [x] 4.4 Indexes & constraints notes
- [ ] 4.5 Backups & retention

5) Auth & RBAC
- [ ] 5.1 Google SSO via Clerk
- [x] 5.2 Role metadata + guard helper
- [ ] 5.3 Role assignment policy (doc)

6) Storage & Evidence
- [ ] 6.1 Supabase Storage bucket evidence (private)
- [ ] 6.2 Upload helper & limits
- [ ] 6.3 Signed URL helper

7) Business Logic — Points & Stages
- [x] 7.1–7.6 Rules captured in docs; scoring/badges logic stubs added

8) Public Pages (content + SEO)
- [ ] 8.1 Landing /
- [ ] 8.2 Leaderboard /leaderboard
- [ ] 8.3 Metrics /metrics/{stage}
- [ ] 8.4 Public profile /u/[handle]
- [ ] 8.5 SEO

9) Participant Dashboard
- [ ] 9.1 /dashboard shell
- [ ] 9.2–9.6 Forms (Learn/Explore/Amplify/Present/Shine)
- [ ] 9.7 My submissions list
- [ ] 9.8 i18n prep (EN → ID)

10) Admin Console
- [ ] 10.1 Submissions queue
- [ ] 10.2 Approval writes ledger + MV refresh
- [ ] 10.3 Users (role/cohort)
- [ ] 10.4 Badges CRUD
- [ ] 10.5 Exports (CSV)
- [ ] 10.6 Kajabi reconciliation
- [ ] 10.7 Audit log

11) Integrations — Kajabi
- [ ] 11.1 Webhook endpoint
- [ ] 11.2 Idempotency tests
- [ ] 11.3 Reconciliation UI

12) Copy & Content Strategy
- [ ] 12.1 Tone & style guide
- [ ] 12.2 Landing hero + How it works
- [ ] 12.3 Consent note
- [ ] 12.4 Empty states

13) Analytics
- [ ] 13.1 Event schema
- [ ] 13.2 KPI dashboards

14) QA & Accessibility
- [ ] 14.1 Unit tests
- [ ] 14.2 E2E tests
- [ ] 14.3 Accessibility pass

15) Security & Privacy
- [ ] 15.1 All writes server‑side
- [ ] 15.2 Rate limits
- [ ] 15.3 PII scrubbing in logs
- [ ] 15.4 Evidence access
- [ ] 15.5 Incident response doc

16) Performance & Reliability
- [ ] 16.1 Index tuning (leaderboard queries)
- [ ] 16.2 Caching
- [ ] 16.3 Error budgets & alerts

17) Launch Plan
- [ ] 17.1 UAT checklist
- [ ] 17.2 Training for reviewers
- [ ] 17.3 Content final pass
- [ ] 17.4 Go‑live
- [ ] 17.5 Post‑launch review

18) Program Flow & Scale
- [ ] 18.1 Align build with expected scale
- [ ] 18.2 Targets reference (p.5)

Page‑By‑Page Build Blocks and Acceptance Test Pack are documented in separate CSV for backlog import.

