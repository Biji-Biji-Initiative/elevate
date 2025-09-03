# Microsoft Elevate Indonesia — FY2026

This plan translates the proposal into an actionable build roadmap and immediate deliverables. It starts with a functional static prototype for engagement and tracking, then evolves into a production-ready web platform.

## Summary of Proposal
- Objective: Empower educators to unlock AI in education through Learn → Explore → Amplify → Present → Shine (LEAPS), and track progress at scale.
- Core Platform Needs:
  - Landing page with program info and sign-in.
  - Elevate Tracker page: evidence uploads/inputs per stage, points, badges, progress.
  - Leaderboard page: rank top educators by points.
  - Admin: simple review/export (later phase).
- LEAPS Stages and Points:
  - Learn: upload one certificate (SPL/ILS) → 20 pts.
  - Explore: describe in-class application, upload evidence → 50 pts.
  - Amplify: cascade to peers/students (2 pts per peer, 1 pt per student) with attendance proof.
  - Present: LinkedIn post URL + policy idea → 20 pts.
  - Shine: recognition/selection to convening; badge unlocks.
- Targets: 25k micro-credentials; 5,000 MCE; 2–3 hour self-paced content with checks; vouchers; national convening.
- Program Flow: MOE engagement → master trainers (150–200) → each trains 100 educators → each educator trains 10 peers/students; support offline training materials.
- Open Questions (from proposal): localization, flexibility for simplified materials, letter routing, linear levels, scope of 21CLD deliverables.

## Scope & Non-Goals (Phase 1)
- In-scope (Phase 1 MVP):
  - Public landing page; educator self-enrollment stub.
  - Local, client-side tracker with forms for all LEAPS stages; visual progress and badges.
  - Leaderboard mock with placeholder data.
  - Documented data model and API spec for production backend.
- Out-of-scope (Phase 1):
  - Real authentication/SSO, file storage, moderation workflow, and production infra.

## Architecture (Target)
- Frontend: Web app (Next.js/React) consuming REST APIs.
- Backend: Node.js (Express/Fastify) with PostgreSQL; storage for uploads (S3 or Azure Blob); background jobs for LinkedIn validation and scoring.
- Admin: Simple dashboard for review/export and leaderboard curation.

## Data Model (Draft)
- Educator(id, name, email, school_id, district, created_at)
- StageProgress(id, educator_id, stage, status, points, submitted_at, approved_at)
- Evidence(id, stage_progress_id, type[file/url/text], url_or_path, metadata)
- AmplifyStats(id, educator_id, peers_count, students_count, proof_evidence_id)
- Badge(id, key, name, description, points_required)
- LeaderboardSnapshot(id, period, data, generated_at)

## Milestones & Deliverables
1. Static Web Prototype (no dependencies)
   - Landing, Tracker, Leaderboard pages.
   - Client-side scoring, progress bar, badges via localStorage.
   - Basic branding and copy.
2. Backend/API Spec and DB Schema
   - OpenAPI draft and SQL schema.
   - Event model for scoring and badges.
3. Backend Skeleton
   - Express app with routes, SQLite locally; storage adapter interface.
4. Frontend Integration
   - Replace localStorage with API calls; file upload flows; auth stub.
5. Admin & Reporting
   - Evidence review, CSV export, leaderboard snapshots.
6. Deployment
   - Staging infra, monitoring, basic security hardening.

## Immediate Next Steps (this repo)
- Consolidate code under top-level `elevate/` folder. [done]
- Provide `elevate/docs/` with API and schema drafts. [done]
- Add `elevate/PROJECT_TRACKER.md` for detailed status tracking. [done]
- Keep earlier `web/` prototype marked legacy until deletion is approved.

## Risks & Assumptions
- Assumes 1 educator account per email; LinkedIn URLs are public.
- File uploads will require storage provider approval; placeholder in MVP.
- Localization to Bahasa Indonesia is needed; copy placeholders provided.

## Open Items for You
- Confirm LEAPS point allocation and badge thresholds.
- Confirm whether levels are linear and any gating rules.
- Confirm admin review requirements (auto vs manual approval).

## Repo Structure (current)
- `elevate/` — top-level project folder
  - `apps/` — Next.js apps (`web`, `admin`)
  - `packages/` — db, auth, types, storage helpers
  - `infra/` — SQL views and migrations
  - `docs/` — openapi + schema + decisions
  - `AGENTS.md`, `README.md`, `.env.example`, `PROJECT_TRACKER.md`
- Root planning artifacts: `about.md`, `plan.md`, `plan2.md`, proposal PDF
- Legacy prototype: `web/` (to be removed after approval)

1) Mono‑repo structure (Turborepo + pnpm)

repo/
├─ apps/
│  ├─ web/                # Public + participant dashboard (Next.js 15 App Router)
│  ├─ admin/              # Next Admin console (Next.js 15, separate app)
│  └─ worker/             # Webhook & jobs runner (Next.js route handlers or standalone)
├─ packages/
│  ├─ ui/                 # shadcn components, tokens, form wrappers
│  ├─ db/                 # Prisma schema + client + SQL views/migrations
│  ├─ auth/               # Clerk helpers, RBAC gates, role constants
│  ├─ types/              # Zod schemas & TS types shared across apps
│  ├─ storage/            # Supabase storage helpers (signed URLs, uploads)
│  └─ config/             # ESLint, TS, Tailwind, Prettier, env parsing (zod)
├─ infra/
│  ├─ supabase/           # SQL migrations (views/materialized views, RLS if/when needed)
│  └─ github/  (also vercel for deployment)           # CI workflows (build, lint, test, preview)
├─ pnpm-workspace.yaml
├─ turbo.json
└─ package.json

Why two apps? Clean blast radius. The participant surface stays UX‑pure; the admin surface ships fast with Next Admin. You can still share everything via packages/.

Workspace quickstart (agents can paste):

// pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "infra/*"

// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "lint":  {},
    "test":  {},
    "dev":   { "cache": false }
  }
}


⸻

1) RBAC model (who sees what)

Roles: participant, reviewer, admin, superadmin.
	•	Participant App (apps/web): only participant (and above, but they’ll have a “Switch to Admin” button).
	•	Admin Console (apps/admin): reviewer+ only.
	•	reviewer: sees assigned submissions (by cohort/school), can approve/reject/adjust within bounds.
	•	admin: all submissions/users/badges/exports/settings.
	•	superadmin: schema & feature flags.

A small, explicit guard used everywhere:

// packages/auth/withRole.ts
import { auth } from "@clerk/nextjs/server";
export function requireRole(minRole: "participant"|"reviewer"|"admin"|"superadmin") {
  const order = ["participant","reviewer","admin","superadmin"];
  return async () => {
    const { userId, sessionClaims } = auth();
    if (!userId) throw new Error("Unauthenticated");
    const role = sessionClaims?.publicMetadata?.role ?? "participant";
    if (order.indexOf(role) < order.indexOf(minRole)) throw new Error("Forbidden");
    return { userId, role };
  };
}

Answering your question directly: Next Admin is not for participants. It’s for reviewers/admins. Participants use the dashboard in apps/web. If master trainers need a light review surface, they get accounts with reviewer role and see a filtered Next Admin view.

⸻

3) Information Architecture (final)

Public (apps/web)

/                       Landing + LEAPS explainer + CTA
/leaderboard            Top 20; toggle all-time / rolling 30d
/metrics/learn|explore|amplify|present  Public aggregates
/u/[handle]             Public profile (approved+public entries only)

Participant (apps/web)

/dashboard
  ├─ /learn
  ├─ /explore
  ├─ /amplify
  ├─ /present
  └─ /shine

Admin (apps/admin, Next Admin)

/admin
  ├─ submissions  (queue with inline evidence, approve/reject/points)
/admin/users      (search, role/cohort edits)
/admin/badges     (CRUD; criteria builder)
/admin/exports    (CSV: users, submissions, ledger)
/admin/kajabi     (raw events; match/unmatched; resolve)

This aligns exactly with LEAPS stages and scoring from your deck (Learn 20; Explore 50; Amplify 2/peer + 1/student; Present 20; Shine = recognition path).  ￼

⸻

4) Data model (Prisma + Postgres @ Supabase)

Ledger‑first; submissions are auditable; webhook events are idempotent.

// packages/db/schema.prisma
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

model User {
  id           String   @id @default(cuid())           // mirror Clerk id if desired
  handle       String   @unique
  name         String
  email        String   @unique
  avatarUrl    String?
  role         Role     @default(PARTICIPANT)
  school       String?
  cohort       String?
  createdAt    DateTime @default(now())
  submissions  Submission[]
  ledger       PointsLedger[]
}

enum Role { PARTICIPANT REVIEWER ADMIN SUPERADMIN }

model Activity {
  code         String   @id          // LEARN, EXPLORE, AMPLIFY, PRESENT, SHINE
  name         String
  defaultPoints Int
}

model Submission {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  activityCode String
  activity     Activity @relation(fields: [activityCode], references: [code])
  status       SubmissionStatus @default(PENDING)
  visibility   Visibility       @default(PRIVATE)
  payload      Json
  attachments  Json             // array of storage paths
  reviewerId   String?
  reviewNote   String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum SubmissionStatus { PENDING APPROVED REJECTED }
enum Visibility       { PUBLIC PRIVATE }

model PointsLedger {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  activityCode String
  source       LedgerSource
  deltaPoints  Int
  externalSource String?        // 'kajabi'
  externalEventId String? @unique
  createdAt    DateTime @default(now())
}

enum LedgerSource { MANUAL WEBHOOK FORM }

model Badge {
  code         String   @id
  name         String
  description  String
  criteria     Json
  iconUrl      String?
}

model KajabiEvent {
  id            String   @id
  receivedAt    DateTime @default(now())
  payload       Json
  processedAt   DateTime?
  userMatch     String?  // matched user.email if found
}

SQL views (migration in infra/supabase/migrations):

-- leaderboard_totals (materialized)
CREATE MATERIALIZED VIEW leaderboard_totals AS
SELECT user_id, SUM(delta_points)::int AS total_points
FROM "PointsLedger"
GROUP BY user_id;

-- metric_counts (simple view)
CREATE VIEW metric_counts AS
SELECT activity_code, COUNT(*)::int AS submissions,
       SUM(CASE WHEN status='APPROVED' THEN 1 ELSE 0 END)::int AS approved
FROM "Submission"
GROUP BY activity_code;

Why Prisma? Agents get type‑safe queries, easy migrations, and we still hit Supabase Postgres over pooled connections. (We can move to RLS in v2 if needed.)

⸻

5) Participant dashboard (what they actually see)

Design: Five stage cards with progress, a “what unlocks next” ribbon, and forms-first evidence.

Example: Learn form (zod + RHF; upload to Supabase Storage):

// apps/web/app/dashboard/learn/page.tsx
"use client";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createLearnSubmission } from "./submit"; // server action
import { Input, Button, Textarea } from "ui";      // from packages/ui

const LearnSchema = z.object({
  provider: z.enum(["SPL","ILS"]),
  course: z.string().min(2),
  completedAt: z.string(), // ISO date
  certificateFile: z.any()
});

export default function LearnPage() {
  const form = useForm({ resolver: zodResolver(LearnSchema) });
  const onSubmit = async (data: any) => { await createLearnSubmission(data); };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* fields … */}
      <Button type="submit">Submit for review</Button>
    </form>
  );
}

// apps/web/app/dashboard/learn/submit.ts
"use server";
import { requireRole } from "auth/withRole";
import { prisma } from "db/client";
import { uploadToBucket } from "storage/supabase";

export async function createLearnSubmission(form: FormData | any) {
  const { userId } = await requireRole("participant")();
  // 1) upload file
  const certPath = await uploadToBucket(userId, form.certificateFile);
  // 2) create submission
  await prisma.submission.create({
    data: {
      userId,
      activityCode: "LEARN",
      payload: { provider: form.provider, course: form.course, completedAt: form.completedAt },
      attachments: [certPath]
    }
  });
  // No points yet: granted on approval or webhook (see §7).
}


⸻

6) Admin Console (Next Admin) — concrete use

Positioning: Next Admin is the review tool. It displays submissions as rows with preview drawers and actions; it also manages users/badges and exports.

Example resource: Submissions queue with approve/reject

// apps/admin/app/admin/submissions/page.tsx
import { requireRole } from "auth/withRole";
import { prisma } from "db/client";
import { DataTable, Button } from "ui";

export default async function SubmissionsPage() {
  await requireRole("reviewer")();
  const rows = await prisma.submission.findMany({
    where: { status: "PENDING" },
    include: { user: true }
  });

  return (
    <DataTable
      rows={rows.map(r => ({
        id: r.id,
        user: r.user.name,
        activity: r.activityCode,
        created: r.createdAt,
        visibility: r.visibility,
        preview: r.payload, // render JSON nicely; link to files via signed URLs
        actions: (
          <>
            <form action={`/admin/actions/approve`} method="post">
              <input type="hidden" name="id" value={r.id}/>
              <Button>Approve</Button>
            </form>
            <form action={`/admin/actions/reject`} method="post">
              <input type="hidden" name="id" value={r.id}/>
              <Button variant="destructive">Reject</Button>
            </form>
          </>
        )
      }))}
    />
  );
}

// apps/admin/app/admin/actions/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "auth/withRole";
import { prisma } from "db/client";

export async function POST(req: NextRequest) {
  await requireRole("reviewer")();
  const form = await req.formData();
  const id = String(form.get("id"));

  const sub = await prisma.submission.update({
    where: { id }, data: { status: "APPROVED" }
  });

  const defaultPoints = await prisma.activity.findUnique({ where: { code: sub.activityCode } });

  await prisma.pointsLedger.create({
    data: {
      userId: sub.userId,
      activityCode: sub.activityCode,
      deltaPoints: defaultPoints?.defaultPoints ?? 0,
      source: "MANUAL"
    }
  });

  return NextResponse.redirect("/admin/submissions");
}

For “users using Next Admin”? Only reviewers and admins use it. If a participant is promoted to reviewer (e.g., master trainer), they’ll log in and see only filtered resources (e.g., by cohort) — enforced in queries and helpers.

⸻

7) Kajabi webhook → auto‑award Learn

// apps/worker/app/api/kajabi/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "db/client";

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const eventId = payload?.event_id ?? `${Date.now()}-${Math.random()}`;
  const email   = payload?.user?.email?.toLowerCase();

  // Persist raw event
  await prisma.kajabiEvent.create({ data: { id: eventId, payload } });

  // Try to match a user by email
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user) return NextResponse.json({ status: "queued_unmatched" }, { status: 202 });

  // Idempotent award
  await prisma.pointsLedger.upsert({
    where: { externalEventId: eventId },
    update: {},
    create: {
      userId: user.id,
      activityCode: "LEARN",
      deltaPoints: 20,           // mirrors deck Learn points
      source: "WEBHOOK",
      externalSource: "kajabi",
      externalEventId: eventId
    }
  });

  // Optionally, create a tiny audit submission if none exists
  await prisma.submission.create({
    data: {
      userId: user.id,
      activityCode: "LEARN",
      status: "APPROVED",
      visibility: "PRIVATE",
      payload: { source: "kajabi", eventId }
    }
  }).catch(() => { /* ignore dupes */ });

  return NextResponse.json({ ok: true });
}

If Kajabi supports signatures, add HMAC verification here; otherwise, whitelist source IPs and rate‑limit.

⸻

8) Leaderboard & public metrics

Query (server component):

// apps/web/app/leaderboard/page.tsx
import { prisma } from "db/client";

export default async function Leaderboard() {
  const rows = await prisma.$queryRaw<
    { user_id: string; total_points: number }[]
  >`SELECT * FROM leaderboard_totals ORDER BY total_points DESC LIMIT 20`;

  // map to user names/handles
}

Toggle rolling 30d: back it with a second materialized view filtered by createdAt > now()-interval '30 days'.

⸻

9) Storage (Supabase) & public pages
	•	Files stored private; public profile renders images via server‑generated signed URLs only when visibility = PUBLIC && status = APPROVED.
	•	packages/storage/supabase.ts exposes uploadToBucket, getSignedUrl(path, ttl).

⸻

10) Security, privacy, and abuse
	•	All writes via server actions or route handlers. No client‑side Supabase writes.
	•	File rules: pdf/jpg/png; ≤10 MB; ≤5 files/submission. Deduplicate by content hash.
	•	Rate limits: per‑user submissions per hour; global webhook rate limit.
	•	Audit log: admin actions (approve/reject/edit points) append to a table.
	•	Sentry on both apps; PII scrubbing on payloads.

⸻

11) CI/CD
	•	GitHub Actions: lint → typecheck → test → build.
	•	Preview deploys per PR (Vercel recommended).
	•	DB migrations auto‑run on deploy; views refresh job nightly.

⸻

12) UX copy (tight and minimal)

Homepage hero

Unlock AI in Your Classroom
Track your LEAPS journey. Earn points. Climb the Top 20.

Consent note (on submit)

You control visibility. Admins review all submissions, but only approved + public entries appear on your profile.

(Points and stages mirror the proposal deck to keep program alignment.  ￼)

⸻

13) Task board (CSV importable backlog)

Paste into Linear/Jira CSV (columns: Epic, Title, Description, Acceptance Criteria)

EPIC,Auth & Foundation,Init Next.js 15 apps (web, admin) + Turborepo,"Two Next apps + shared packages; Tailwind/shadcn init; Clerk wired","Login works; /dashboard gate; /admin gate"
EPIC,DB Layer,Prisma schema & migrations,"Models: User, Activity, Submission, PointsLedger, Badge, KajabiEvent; SQL views","Prisma migrate succeeds; views exist"
EPIC,UI Kit,Shared UI package,"Buttons, Forms (RHF + zod), DataTable, FileUploader","Storybook renders; forms validate"
EPIC,Dashboard,Stage forms (Learn/Explore/Amplify/Present/ Shine),"zod schemas; uploads; server actions","Submissions create; file limits enforced"
EPIC,Review,Next Admin submissions queue,"List PENDING; preview payload & files; approve/reject","Ledger entries created; totals refresh"
EPIC,Profiles,/u/[handle] public pages,"Approved+public only; signed URLs","SEO tags; pagination"
EPIC,Leaderboard,Top 20 + rolling 30d toggle,"Query MV; tie to profiles","Displays ranks; stable under load"
EPIC,Webhook,Kajabi endpoint + reconciliation,"Persist raw; idempotent award; unmatched queue","Manual resolve tool works"
EPIC,Ops,Audit log + exports + rate limits,"Admin actions logged; CSV export endpoints","Hard + soft limits in place"
EPIC,QA,Playwright E2E for critical paths,"Sign‑in; submit; admin approve; leaderboard updates","Green in CI"


⸻

14) Decision toggles (defaults chosen, flip if you disagree)
	•	Admin framework: Next Admin now; fallback to Refine if table ergonomics block reviewers.
	•	DB access: Prisma direct to Supabase (server‑only). RLS deferred to v2.
	•	Leaderboard: all‑time + rolling 30d.
	•	Public default: private by default with a “Make public” toggle (reward with a badge).
	•	Handles: @firstlastNN, editable once.

⸻

15) Why this will hold under scale
	•	Clear separation of concerns (participant vs admin), but shared code via packages/*.
	•	Event‑sourced points ensure we can replay/repair if Kajabi changes payloads.
	•	Monorepo + CI discipline keeps 10+ contributors/agents synchronized.
	•	You can spin an entire local stack with pnpm i && pnpm -w dev and it “just works”.

⸻

16) Next Admin usage—one more pass (practical)
	•	Good fits: submission triage, bulk filters, quick edits, exports, badge CRUD, Kajabi reconciliation.
	•	Bad fits: participant UX, storytelling feeds, gamified progress. Don’t bend it there—stay custom.


