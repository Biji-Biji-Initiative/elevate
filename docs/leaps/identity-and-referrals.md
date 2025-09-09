# Identity & Referrals — Educator vs Student and Attribution

User types

- `user_type`: EDUCATOR | STUDENT (persisted on `users` and mirrored to Clerk publicMetadata.user_type).
- Default: EDUCATOR if not specified.

Capture points

- Sign-up: require user_type selection.
- Referral links: `/?ref=<code>&type=educator|student` → store pending type; on account creation, set `user_type` accordingly and `referred_by_user_id` if ref is valid.

Policy

- Students cannot submit LEAPS evidence or appear on leaderboard.
- LEARN awards and public counters exclude STUDENT; reject webhook award if resolved user is STUDENT.

Schema additions (proposed)

- users.user_type enum (default EDUCATOR)
- users.referred_by_user_id (nullable FK)
- referral_events: { id, referrer_user_id, referee_user_id, event:'signup'|'learn_completion', created_at }

Attribution rules (MVP)

- Award referrer when referee completes LEARN (two tags) within 30 days.
- Idempotent per referrer/referee; one award max.

Anti‑gaming

- Block self‑referral and A↔B circular referrals within 30 days.
- Rate‑limit signups by device/IP; reject disposable email domains.

## Student enforcement and flips

- Webhook: if resolved user_type is `STUDENT`, reject LEARN awards with `type:'auth', code:'STUDENT_NOT_ELIGIBLE'`.
- Counters: always join on current `users.user_type` and exclude STUDENT from public aggregates.
- Post-award EDU→STUDENT flips: existing ledger rows remain (immutability) but are excluded from public counters due to current-type filtering.
