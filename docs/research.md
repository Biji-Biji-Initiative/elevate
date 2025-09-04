# Research Notes — Kajabi (LEARN/MCE) and AMPLIFY Flow Audit

Last updated: (manual)

## 1) Kajabi Integration — Current Behavior (LEARN)

What happens today when Kajabi sends a webhook:

- Endpoint: `/api/kajabi/webhook` (verifies HMAC, audits payload, idempotent by event id/fingerprint).
- Processes ONLY tag `LEARN_COMPLETED`.
- Finds user by email (lowercased), stores `kajabi_contact_id` on first match.
- Idempotency checks:
  - `kajabi_events.id` and `points_ledger.external_event_id` to avoid duplicates.
- Awards points by creating a `points_ledger` entry with `activity_code='LEARN'`, `source='WEBHOOK'`.
- Does NOT create a `Submission` for LEARN and does NOT award badges here.

Implications for homepage counters and leaderboard:

- Leaderboard: correct — it aggregates from `points_ledger` and will include LEARN points from Kajabi.
- Homepage stage counters (e.g., Learn completions) currently read from `submissions` by stage/status. Because the webhook does not create a LEARN submission, counters won’t reflect Kajabi events unless:
  - We also create a LEARN submission on webhook; or
  - We change counters to read from `points_ledger`/badges instead of submissions.

### 1.a) Kajabi tag schema and points mapping (proposed, minimal changes)

Use Kajabi “Tag is added” automation for the two course completions you defined:

- Required tags (create in Kajabi):

  - `elevate-ai-1-completed`
  - `elevate-ai-2-completed`

- Points rule (per program canon: one qualifying certificate per educator):

  - When the FIRST of the above tags is added for a user, award LEARN +20 once per user.
  - Ignore duplicates and the second tag for the same user (idempotent by event id + ledger `external_event_id`).

- Optional convenience tag (Kajabi-side, not required):

  - `elevate-learn-completed` — added by Kajabi automation when either of the two course tags is added (first time only). If added, we can listen for this aggregator tag instead; current webhook code checks a single tag name. Either approach is fine — we’ll implement support for your two specific tags.

- Automation configuration (Kajabi):

  - Trigger: “Tag is added”.
  - Condition: Tag equals `elevate-ai-1-completed` OR `elevate-ai-2-completed` (two automations if needed).
  - Action: Send webhook to `https://<your-domain>/api/kajabi/webhook` with JSON containing at least:
    - `event_id` (stable identifier)
    - `created_at`
    - `contact: { id, email }`
    - `tag: { id, name }` (name must be one of the two above)

- Undo/remediation (optional):

  - If a completion is rescinded in Kajabi, you can send a second event (e.g., `Tag is removed`) and we can log it for reviewer action. We will not auto‑revoke points without admin review unless explicitly requested.

- Test checklist:
  - Add each tag to a test contact and confirm:
    - webhook arrives with email + tag name
    - ledger shows one LEARN +20 entry only once per user
    - `kajabi_events` has one row for the event
    - leaderboard increments LEARN points for that user

### 1.b) Variant — Two‑course scheme (10 + 10) with badge after 20 (preferred if you want per‑course credit)

If each of the two courses should award 10 points independently and the badge unlocks at 20 total:

- Tags to use (same as above):

  - `elevate-ai-1-completed` → +10
  - `elevate-ai-2-completed` → +10

- Webhook mapping (backend behavior):

  - Accept both tags; for each tag, create one `points_ledger` row with `delta_points=10`.
  - Idempotency key should include the tag name (e.g., `external_event_id = kajabi:<event_id>|tag:<name>`). This ensures the same tag is never applied twice, and each course can credit once.
  - Guardrail: cap total LEARN-from-Kajabi at 20 per user (if both tags applied). Extra or unexpected tags should not exceed 20.

- Activity coding options (choose one):

  - A) Keep a single `activity_code='LEARN'`, store `delta_points=10`, and include `{ course: '1'|'2' }` in audit payload for traceability.
  - B) Add two new activities `LEARN_AI_1` and `LEARN_AI_2` with `default_points=10` (cleaner reporting per course). Leaderboard already sums by activity, so both will roll up to the user’s total.

- Badge unlock (Starter):

  - On processing a course tag, compute user’s cumulative LEARN points (or sum of LEARN_AI_1 + LEARN_AI_2). When it reaches ≥20 the first time, create `earned_badges` row (e.g., `badge_code='STARTER'`). Idempotent by `@@unique(user_id, badge_code)`.

- Homepage counters alignment:

  - If counters must reflect Learn as “certificate earned”, create a single LEARN Submission when the FIRST course tag is processed, mark as APPROVED (auto), with payload `{ provider: 'Kajabi', tags_seen: ['elevate-ai-1-completed'] }` and later update to include the second tag if it arrives. This keeps submission-based counters correct while awarding points per course separately.
  - Alternatively, switch Learn counters to be points/badge‑based (simpler), so no synthetic submission is needed.

- QA checklist (10+10):
  - Add only `elevate-ai-1-completed` → ledger +10; no badge; counters show one Learn completion if using submission-based counters.
  - Add `elevate-ai-2-completed` → ledger +10 (total +20); badge `STARTER` granted idempotently; leaderboard reflects +20; counters unchanged (still one completion) unless using points-based counters.

## 2) “MCE Certified” vs Kajabi LEARN Tags

- MCE certified = Microsoft Certified Educator (global credential). It is not the same as a Kajabi course tag.
- Current stats return `mce_certified: 0` (placeholder) — there is no data source connected.
- Options to source MCE:
  - Count an `earned_badges` record with `badge_code='MCE'`.
  - Add `mce_certified_at`/`mce_certified` on `user` and count those.
  - Import a periodic authority feed/CSV into `mce_certifications` and join in `/api/stats`.

If program logic requires “two Kajabi course completions → award a micro‑credential badge”: not implemented. Today only `LEARN_COMPLETED` is recognized; nothing checks for multiple tags.

## 3) AMPLIFY Flow — End‑to‑End Audit

Participant UI (apps/web):

- Page: `/app/[locale]/dashboard/amplify/page.tsx`.
- Form collects:
  - `peersTrained` (max 50) and `studentsTrained` (max 200).
  - Evidence uploads (attendance files) to Supabase storage via `uploadFile`.
  - Shows potential points: peers×2 + students×1 with caps.
- On submit: creates a `Submission` (`activity_code='AMPLIFY'`, `payload` contains counts & evidence). Visibility defaults to PRIVATE.

Server validation (apps/web):

- Endpoint: `/app/api/submissions` POST.
- For `AMPLIFY`:
  - Computes last 7 days’ totals from the user’s AMPLIFY submissions and enforces rolling caps before accepting the new submission.
  - Validates payload via `parseAmplifyPayload`.

Review & points awarding (admin):

- Admin approves/rejects in Admin app.
- Approve path (single and bulk):
  - Computes points with `computePoints()` (peers×2 + students×1, capped), allows limited adjustment (+/−20%).
  - Creates a `points_ledger` row with `source='MANUAL'` and an `external_event_id` of the submission.

Leaderboard and metrics:

- Leaderboard aggregates from `points_ledger` by `activity_code`, so AMPLIFY points appear once approved.
- `/api/stats` “studentsImpacted” is derived by summing `studentsTrained` from APPROVED AMPLIFY submissions.

Share/referral/link logic:

- No dedicated referral/share link for AMPLIFY is implemented.
- A generic `ShareButton`/`SocialShareButtons` exists in UI library (for social sharing) but is not wired to AMPLIFY nor to any referral tracking.
- There is no mechanism where the trainer’s share link causes auto‑credit when recipients sign up or join Kajabi. AMPLIFY points accrue only via participant submission + admin approval.

## 4) Gaps and Open Decisions

- LEARN via Kajabi vs homepage counters:
  - Counters read from `submissions`; Kajabi awards only `points_ledger`. Choose one:
    1. Create a LEARN submission on webhook receipt (auto‑approved), so counters reflect Kajabi; or
    2. Change counters to use `points_ledger`/badges for LEARN instead of submissions.
- MCE certified data source: pick one (badge, user flag, or import feed) and implement; today it is placeholder 0.
- AMPLIFY referral/share:
  - No share link, referral ID, or Kajabi callback to the trainer. If desired, add a referral code or query param and a callback handler to attribute sign‑ups.
- AMPLIFY caps:
  - Server enforces 7‑day rolling totals. Product brief mentions monthly caps; confirm period and numbers to avoid confusion.
- Badges:
  - Stage badges on first completion and milestone badges are documented, but webhook/admin approval paths don’t currently award them automatically; ensure badge assignment rules are implemented where desired.

## 4.a) Invitation/Referral Plan (Proposed — No Code Yet)

Goals:

- Let trainers invite peers/students and earn AMPLIFY credit when invitees complete required actions (e.g., sign up or complete Learn on Kajabi).
- Preserve privacy and verifiability; prevent gaming.

Elements:

1. Referral identity

   - Generate a per‑user `refCode` (e.g., short hash of `user_id`). Store on `user`.
   - Share URL format: `https://leaps.mereka.org/?ref=<refCode>` (for general) and per‑stage deep links, e.g., `...?ref=<refCode>&stage=learn`.

2. Attribution capture

   - On first visit with `ref`, set a first‑party cookie `ref=<refCode>; Max-Age=90d` (consent‑respecting).
   - On sign‑up, persist `referred_by_user_id` by resolving `refCode` to a user.

3. Event attribution

   - For Learn via Kajabi: extend webhook processing to check if the user has `referred_by_user_id` set; if yes, record an attribution event.
   - For AMPLIFY credit via referral: define rules — e.g., award referrer +2 points when a referred educator completes Learn (or a flat bonus with caps).

4. Anti‑gaming & validation

   - Rate limits per referrer; daily/weekly caps for referral bonuses.
   - Distinct emails; optional domain constraints for institutional referrals.
   - Audit table `referral_events(referrer_id, referred_id, event_type, source, external_event_id, created_at)`.

5. Reporting & reconciliation

   - Admin views to search referrals and drill down events.
   - Export for audits.

Open questions to confirm:

- What event earns the referrer points? (Sign‑up, LEARN completion tag, both?)
- Bonus amounts and period caps?
- Do referred users also get a join bonus?

## 4.b) Implementation Steps (Fit to Current Architecture)

Non‑breaking, incrementally deployable, avoiding drift:

- Data model (DB/Prisma)

  - Add columns on `users`: `ref_code` (unique), `referred_by_user_id` (nullable, FK).
  - New table `referral_events` with fields: `id`, `referrer_id`, `referred_id`, `event_type` ('signup' | 'learn_completed'), `external_event_id`, `source` ('cookie' | 'kajabi'), `created_at`.
  - Optional: new `activities` row `REFERRAL` (default_points=0) for clean points categorization.

- Web (apps/web)

  - Middleware: read `?ref=` and set cookie if present; never overwrite an existing referral cookie.
  - Sign‑up path: in Clerk webhook (`/api/webhooks/clerk`), if cookie present and valid, set `referred_by_user_id` and persist.
  - Share UI: reuse `@elevate/ui` SocialShareButtons where appropriate; render user’s personalized URL.

- Webhooks (Kajabi)

  - Today: tag `LEARN_COMPLETED` → award LEARN points to the learner.
  - Add: when processing LEARN tag, if learner has `referred_by_user_id` and a matching, not‑yet‑credited referral event, then:
    - Create a `referral_events` row with `event_type='learn_completed'` and `external_event_id=provider event id` (idempotent), and
    - Award referrer a referral bonus via `points_ledger` (activity_code `REFERRAL` or LEARN bonus) with `external_event_id='referral:<event>'`.

- Admin (apps/admin)

  - New view/filter to list `referral_events` and related users.
  - Manual reprocess action for missed webhooks.

- Stats/leaderboard

  - Leaderboard continues to aggregate via `points_ledger`; referral points appear under `REFERRAL` activity if introduced.
  - `/api/stats` may include referral KPIs (total referrals, conversion to Learn).

- Observability & idempotency
  - Maintain idempotency via unique `external_event_id` on `points_ledger` and `referral_events`.
  - Structured logging for referral decisions; dashboards/alerts for webhook errors.

## 4.c) Kajabi Event Contract (Requested from Kajabi)

To fully automate the flow, request the following payloads (or map their existing events accordingly):

- Event: `contact.tagged`

  - Required fields: `event_id`, `created_at`, `contact: { id, email }`, `tag: { id, name }`.
  - Tag semantics:
    - `LEARN_COMPLETED` (or separate tags per course, e.g., `elevate-ai-1-completed`, `elevate-ai-2-completed`).
  - Behavior:
    - Award LEARN points to the contact’s matched user (only once per tag, total cap 20 across both).
    - Trigger referral bonus path if the learner has `referred_by_user_id`.

- Optional Event: `offer.granted`
  - If reliable, can be used as a proxy for Learn completion in certain programs.

Security & reliability:

- HMAC signature header with shared secret (already implemented).
- Retries/backoff from Kajabi; our endpoint remains idempotent by `external_event_id`.

## 5) Suggested Next Steps (no code, for planning)

1. Decide how LEARN completions should appear on homepage counters (Submission‑based vs Points/Badge‑based) and implement one source of truth.
2. Define MCE source of truth and add counting to `/api/stats`.
3. If AMPLIFY referral is a requirement, design a simple referral model:
   - Issue per‑user share URL with `ref=<userId>`; record sign‑ups; tie later activity to referrer; decide on credit rules.
4. Confirm AMPLIFY cap period (7‑day vs monthly); align UI copy and server checks.
5. Confirm badge auto‑award rules on approval/webhook and wire into approval/webhook code.

---

References (paths):

- Kajabi webhook: `apps/web/app/api/kajabi/webhook/route.ts`
- Submissions API: `apps/web/app/api/submissions/route.ts`
- Admin approval: `apps/admin/app/api/admin/submissions/route.ts`
- Scoring: `packages/logic/src/scoring.ts`
- Amplify form (participant): `apps/web/app/[locale]/dashboard/amplify/page.tsx`
- Stats: `apps/web/app/api/stats/route.ts`
- Share UI (generic): `packages/ui/src/components/ShareButton.tsx`
