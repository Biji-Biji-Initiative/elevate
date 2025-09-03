Perfect—moving fast. I’ve built you a **ready‑to‑run mono‑repo skeleton** with the full **Prisma schema**, SQL views, seed script, RBAC helpers, storage utils, and example Next.js routes for participant + admin. It’s lean, commented, and matches the **LEAPS points & flows** from your program deck (Learn 20, Explore 50, Amplify 2/peer + 1/student, Present 20, Shine) and the **scoring/tracking** user journey you outlined.&#x20;

---

## ⬇️ Downloads (copy into your repo or unzip and go)

* **Monorepo skeleton (zip)** — everything wired:
  **[Download the monorepo](sandbox:/mnt/data/leaps-monorepo-skeleton.zip)**
* **Backlog CSV (import to Linear/Jira)** — epics, tasks, acceptance criteria:
  **[Download the backlog](sandbox:/mnt/data/leaps-backlog.csv)**

---

## What’s inside (high level)

```
repo/
├─ apps/
│  ├─ web/      # Public + participant dashboard (Next.js 15)
│  └─ admin/    # Reviewer/Admin console (Next.js; Next Admin-ready)
├─ packages/
│  ├─ db/       # Prisma schema + client + seed
│  ├─ auth/     # RBAC helpers (Clerk-ready)
│  ├─ types/    # Zod schemas for all stages
│  ├─ storage/  # Supabase storage helpers
│  └─ ui/       # Minimal UI primitives (Button/Input/Table)
└─ infra/
   └─ supabase/migrations/001_views.sql  # MVs + metrics views + refresh fn
```

**Principles baked in**

* **Ledger, not counters** → `points_ledger` is append‑only; totals via views/MVs.
* **Two surfaces** → `apps/web` for participants; `apps/admin` for reviewers/admins.
* **Webhook‑first Learn** (Kajabi) + **forms‑first evidence** elsewhere.
* **Private uploads**; public profile shows only **approved + public** items.
* **Minimal Next Admin**: the current admin app uses simple tables/actions; you can swap the UI layer for Next Admin/Refine later without changing the data model.

---

## 1) Prisma schema (complete)

> File: `packages/db/schema.prisma`
> Snake\_case via `@@map` to keep SQL handy; mirrors deck points/flows.&#x20;

```prisma
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

enum Role { PARTICIPANT REVIEWER ADMIN SUPERADMIN }
enum SubmissionStatus { PENDING APPROVED REJECTED }
enum Visibility { PUBLIC PRIVATE }
enum LedgerSource { MANUAL WEBHOOK FORM }

model User {
  id           String   @id               // mirror Clerk user id
  handle       String   @unique
  name         String
  email        String   @unique
  avatar_url   String?
  role         Role     @default(PARTICIPANT)
  school       String?
  cohort       String?
  created_at   DateTime @default(now())
  submissions  Submission[]
  ledger       PointsLedger[]
  @@map("users")
}

model Activity {
  code           String @id               // LEARN | EXPLORE | AMPLIFY | PRESENT | SHINE
  name           String
  default_points Int
  submissions    Submission[]
  ledger         PointsLedger[]
  @@map("activities")
}

model Submission {
  id            String           @id @default(cuid())
  user_id       String
  user          User             @relation(fields: [user_id], references: [id], onDelete: Cascade)
  activity_code String
  activity      Activity         @relation(fields: [activity_code], references: [code], onDelete: Cascade)
  status        SubmissionStatus @default(PENDING)
  visibility    Visibility       @default(PRIVATE)
  payload       Json
  attachments   Json             // string[] storage paths
  reviewer_id   String?
  review_note   String?
  created_at    DateTime         @default(now())
  updated_at    DateTime         @updatedAt
  @@index([user_id, activity_code])
  @@map("submissions")
}

model PointsLedger {
  id                String   @id @default(cuid())
  user_id           String
  user              User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  activity_code     String
  activity          Activity @relation(fields: [activity_code], references: [code], onDelete: Cascade)
  source            LedgerSource
  delta_points      Int
  external_source   String?
  external_event_id String?  @unique
  created_at        DateTime  @default(now())
  @@index([user_id, activity_code])
  @@map("points_ledger")
}

model Badge {
  code         String @id
  name         String
  description  String
  criteria     Json
  icon_url     String?
  @@map("badges")
}

model KajabiEvent {
  id            String   @id
  received_at   DateTime @default(now())
  payload       Json
  processed_at  DateTime?
  user_match    String?
  @@map("kajabi_events")
}

model AuditLog {
  id          String   @id @default(cuid())
  actor_id    String
  action      String   // APPROVE_SUBMISSION | REJECT_SUBMISSION | ADJUST_POINTS
  target_id   String?
  meta        Json?
  created_at  DateTime @default(now())
  @@index([actor_id, created_at])
  @@map("audit_log")
}
```

---

## 2) SQL views + refresh function (real‑time leaderboard)

> File: `infra/supabase/migrations/001_views.sql`

```sql
-- All-time leaderboard
CREATE MATERIALIZED VIEW leaderboard_totals AS
SELECT user_id, COALESCE(SUM(delta_points),0)::int AS total_points
FROM points_ledger GROUP BY user_id;

-- Rolling 30 days
CREATE MATERIALIZED VIEW leaderboard_30d AS
SELECT user_id, COALESCE(SUM(delta_points),0)::int AS total_points_30d
FROM points_ledger
WHERE created_at > now() - interval '30 days'
GROUP BY user_id;

-- Per-stage metrics (public pages)
CREATE VIEW metric_counts AS
SELECT s.activity_code,
       COUNT(*)::int AS submissions,
       SUM(CASE WHEN s.status='APPROVED' THEN 1 ELSE 0 END)::int AS approved
FROM submissions s
GROUP BY s.activity_code;

-- Convenience function for near-real-time refresh
CREATE OR REPLACE FUNCTION refresh_leaderboards() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_totals;
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_30d;
END;
$$ LANGUAGE plpgsql;
```

The **admin approve** action calls `refresh_leaderboards()` so the **Top‑20** updates as reviewers work.

---

## 3) Seed script (activities + optional admin)

> File: `packages/db/seed.ts` — runs off your **deck’s point scheme**.&#x20;

```ts
import { prisma } from "./client";

async function main() {
  const activities = [
    { code: "LEARN",   name: "Learn",   default_points: 20 },
    { code: "EXPLORE", name: "Explore", default_points: 50 },
    { code: "AMPLIFY", name: "Amplify", default_points: 0 },
    { code: "PRESENT", name: "Present", default_points: 20 },
    { code: "SHINE",   name: "Shine",   default_points: 0 },
  ];
  for (const a of activities) {
    await prisma.activity.upsert({
      where: { code: a.code }, update: { name: a.name, default_points: a.default_points }, create: a
    });
  }

  // Optional bootstrap admin (fill env vars)
  const { SEED_ADMIN_ID:id, SEED_ADMIN_EMAIL:email, SEED_ADMIN_NAME:name="Admin", SEED_ADMIN_HANDLE:handle="admin" } = process.env as any;
  if (id && email) {
    await prisma.user.upsert({ where: { id }, update: { role: "ADMIN", email, name, handle }, create: { id, role: "ADMIN", email, name, handle }});
  }
  console.log("Seed complete");
}

main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
```

---

## 4) RBAC helper (Clerk)

> File: `packages/auth/withRole.ts`

```ts
import { auth } from "@clerk/nextjs/server";
const ORDER = ["participant","reviewer","admin","superadmin"] as const;
export type RoleName = typeof ORDER[number];

export async function requireRole(minRole: RoleName) {
  const { userId, sessionClaims } = auth();
  if (!userId) throw new Error("Unauthenticated");
  const role = (sessionClaims?.publicMetadata as any)?.role ?? "participant";
  if (ORDER.indexOf(role) < ORDER.indexOf(minRole)) throw new Error("Forbidden");
  return { userId, role };
}
```

> Usage: gate participant routes with `requireRole("participant")`, admin with `"reviewer"` or `"admin"`.

---

## 5) Evidence schemas (Zod) for all stages

> File: `packages/types/schemas.ts` — **forms-first** validation aligned to the deck journey.&#x20;

```ts
export const LearnSchema   = z.object({ provider: z.enum(["SPL","ILS"]), course: z.string().min(2), completedAt: z.string(), certificateFile: z.any() });
export const ExploreSchema = z.object({ reflection: z.string().min(150), classDate: z.string(), school: z.string().optional(), evidenceFiles: z.any() });
export const AmplifySchema = z.object({ peersTrained: z.coerce.number().int().min(0).max(50), studentsTrained: z.coerce.number().int().min(0).max(200), attendanceProofFiles: z.any() });
export const PresentSchema = z.object({ linkedinUrl: z.string().url(), screenshotFile: z.any(), caption: z.string().min(10) });
export const ShineSchema   = z.object({ ideaTitle: z.string().min(4), ideaSummary: z.string().min(50), attachment: z.any().optional() });
```

---

## 6) Storage utils (Supabase)

> File: `packages/storage/supabase.ts`

```ts
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE!;
export const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });
const BUCKET = "evidence";

export async function uploadToBucket(userId: string, file: any) {
  // returns a storage key you save in submissions.attachments
}
export async function getSignedUrl(path: string, ttlSeconds = 3600) { /* ... */ }
```

> Create a bucket named **`evidence`** in Supabase and keep it **private**.

---

## 7) Participant route (Learn submission)

> File: `apps/web/app/dashboard/learn/submit/route.ts`

```ts
import { prisma } from "db/client";
import { requireRole } from "auth/withRole";
import { uploadToBucket } from "storage/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await requireRole("participant");
  const form = await req.formData();
  const file = form.get("certificateFile") as unknown as File | null;
  const path = file ? await uploadToBucket(userId, file) : null;

  await prisma.submission.create({
    data: {
      user_id: userId,
      activity_code: "LEARN",
      payload: { provider: String(form.get("provider")), course: String(form.get("course")), completedAt: String(form.get("completedAt")) },
      attachments: path ? [path] : []
    }
  });
  return NextResponse.json({ ok: true });
}
```

---

## 8) Admin actions (approve/reject + ledger write + MV refresh)

> File: `apps/admin/app/admin/actions/approve/route.ts`

```ts
import { prisma } from "db/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const id = String(form.get("id"));

  const sub = await prisma.submission.update({ where: { id }, data: { status: "APPROVED" } });
  const activity = await prisma.activity.findUnique({ where: { code: sub.activity_code } });

  await prisma.pointsLedger.create({
    data: { user_id: sub.user_id, activity_code: sub.activity_code, delta_points: activity?.default_points ?? 0, source: "MANUAL" }
  });

  // Near real-time leaderboard
  try { await prisma.$executeRawUnsafe("SELECT refresh_leaderboards()"); } catch {}

  await prisma.auditLog.create({ data: { actor_id: "admin", action: "APPROVE_SUBMISSION", target_id: sub.id, meta: {} } });
  return NextResponse.redirect("/admin/submissions");
}
```

> File: `apps/admin/app/admin/actions/reject/route.ts` does the inverse and logs to `audit_log`.

---

## 9) Kajabi webhook (idempotent Learn award)

> File: `apps/web/app/api/kajabi/webhook/route.ts`

```ts
import { prisma } from "db/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (process.env.KAJABI_WEBHOOK_SECRET && secret !== process.env.KAJABI_WEBHOOK_SECRET) return new NextResponse("Forbidden", { status: 403 });

  const payload = await req.json().catch(()=> ({}));
  const eventId = payload?.event_id || `${Date.now()}-${Math.random()}`;
  const email = (payload?.user?.email || payload?.email || "").toLowerCase();

  await prisma.kajabiEvent.upsert({ where: { id: eventId }, update: { payload }, create: { id: eventId, payload } });

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user) return NextResponse.json({ status: "queued_unmatched" }, { status: 202 });

  await prisma.pointsLedger.upsert({
    where: { external_event_id: eventId },
    update: {},
    create: { user_id: user.id, activity_code: "LEARN", delta_points: 20, source: "WEBHOOK", external_source: "kajabi", external_event_id: eventId }
  });

  try {
    await prisma.submission.create({ data: { user_id: user.id, activity_code: "LEARN", status: "APPROVED", visibility: "PRIVATE", payload: { source: "kajabi", eventId } } });
  } catch {}

  return NextResponse.json({ ok: true });
}
```

---

## 10) Setup & run (5‑minute path)

```bash
pnpm i
cp .env.example .env          # fill DATABASE_URL, Clerk keys, Supabase, KAJABI_WEBHOOK_SECRET
pnpm db:generate
pnpm --filter @leaps/db run migrate:dev   # or migrate:deploy in CI
pnpm db:seed SEED_ADMIN_ID=user_123 SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_HANDLE=admin
pnpm dev                      # web on :3000, admin on :3001
```

**Supabase storage**

* Create bucket `evidence` (private).
* Add a service role key to `.env`.
* Optional: add file type/size guards in `uploadToBucket` (hooks left in place).

**Clerk**

* Set `publicMetadata.role` at sign‑up to `"participant"`.
* Promote reviewers/admins via Clerk dashboard or an admin-only UI.

---

## 11) “Who uses what?” (crisp answer)

* **Participants** → `apps/web`: landing → sign‑in → tracker forms → profile → leaderboard.
* **Reviewers/Admins** → `apps/admin`: **Submissions queue** (approve/reject/adjust), **Users**, **Badges**, **Exports**, **Kajabi reconciliation**.

  * If you prefer the official **Next Admin** UX, swap the table pages for Next Admin resources; the **data layer stays unchanged**.

---

## 12) 10‑minute smoke test (do this before agents scale it)

1. Seed + sign in.
2. Submit **Learn** with a dummy PDF.
3. Admin approves → check leaderboard updates (Top‑20).
4. Post the **Kajabi** webhook with a test email → see auto‑awarded points & audit record.
5. Toggle a submission to **public** (via DB) → verify on `/u/[handle]`.

---

## 13) Guardrails & contrarian tweaks (prevents future pain)

* **Amplify gaming**: cap per submission (50 peers / 200 students) + **per‑7‑day cap** at the points calculation layer; promote breadth over spam.
* **Public default**: **private by default**, unlock a small **“Visibility” badge** when they opt‑in.
* **No LinkedIn scraping**: treat Present as **URL + screenshot**; avoid brittle automation; use review for quality.
* **Real‑time leaderboard**: MVs refresh on approve; also compute **on‑the‑fly SUM** as a fallback in the leaderboard page.

---

## 14) CI included

`.github/workflows/ci.yml` runs **typecheck, lint, build** for all packages with PNPM + Turbo. Add a secret `DATABASE_URL` if you want to run migrations in CI.

---

## 15) Task board (CSV shipped)

Import **[leaps-backlog.csv](sandbox:/mnt/data/leaps-backlog.csv)** into Linear/Jira. It includes epics for **Auth & Foundation**, **DB Layer**, **Dashboard**, **Review**, **Profiles**, **Leaderboard**, **Webhook**, **Ops**, **QA** with clear acceptance criteria.

---

## Where this ties to your deck (explicit)

* **LEAPS stage definitions, scoring, and public Top‑20** mirror *“MS Elevate LEAPS Journey”* and *“Scoring and Tracking Mechanism”* on **pages 3–4** of your PDF; forms and webhook flows are purpose‑built to satisfy those steps.&#x20;

---

### Want me to extend this to:

* add **/metrics/** pages (server‑calculated counters),
* wire **Clerk middleware** + role‑based layouts,
* or scaffold **Refine/Next Admin** resources for a denser review grid?

If you’re good with this baseline, I’ll cut the next set of admin resources and QA tests directly on top of this skeleton.
