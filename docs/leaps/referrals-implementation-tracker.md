# Referrals & Invites — Implementation Tracker

Scope

- Remove LEARN form (Option B: points from Kajabi tags only)
- Add user-facing referral invites for AMPLIFY (+2 educator, +1 student at signup)
- Surface login-aware CTAs on metrics and dashboard

Decisions

- Award on signup based on referee user_type (educator=+2, student=+1)
- Attribute via generic `?ref=<code>` cookie → first dashboard visit; invitee chooses Educator/Student during onboarding
- Count referral bonus under `AMPLIFY` in `points_ledger` with `source='FORM'` and `external_event_id='referral:signup:<referee_id>'`

DB deltas

- users: `ref_code` (unique), `referred_by_user_id` (nullable)
- referral_events: (id, referrer_user_id, referee_user_id, event_type, external_event_id?, source?, created_at)
- Idempotency: unique (referrer_user_id, referee_user_id, event_type)

Code changes (this PR)

- Removed `/{locale}/dashboard/learn` page; LEARN routes to metrics
- Metrics pages: Signed-in CTAs to submit forms; AMPLIFY adds “Invite” CTA
- New `/{locale}/dashboard/amplify/invite` page with share link
- Middleware: capture `ref` and `type` query params into cookies
- Dashboard API: on first load, resolve cookies → set `referred_by_user_id`, adjust `user_type` if `type=student`, award signup bonus idempotently
- Prisma schema + Supabase migration for referral tables/columns

Follow-ups

- Optional caps: additional daily rate-limits
- Admin UI: simple referrals list/search (later)
- Extend Kajabi webhook to award a second bonus on LEARN completion (only if requested)

Validation

- Share invite link → sign up as educator → first dashboard load awards +2 to referrer
- Share invite link with `&type=student` → sign up → awards +1; user_type set to STUDENT; student cannot submit
- Leaderboard/points reflect ledger entries under AMPLIFY
