# LEAPS Onboarding — Required Fields

This onboarding captures the minimum required profile data to enable LEAPS features and enforce permissions.

## Source of Truth

- Role is stored in Clerk `publicMetadata.user_type` ('EDUCATOR' | 'STUDENT').
- The app mirrors role and profile data to the DB via webhook/API.

## Required Fields

- All users: Role (Educator | Student)
- Educators only: School, Region/Province

## Flow

1. After sign‑up, users are routed to `/{locale}/onboarding/user-type`.
2. Educators provide School (autocomplete) and Region.
3. Client calls `POST /api/profile/onboarding` — updates Clerk first, then DB (`users.user_type`, `user_type_confirmed=true`, `users.school`, `users.region`).
4. Redirect to dashboard.
5. Fallback: If role is missing (edge case), the dashboard redirect sends the user to onboarding once.

## Defaults

- New accounts default to `STUDENT` until the user explicitly selects a role on the onboarding page. This prevents accidental educator permissions.

## Permissions

- Students:
  - Cannot submit LEAPS evidence; not on leaderboard; Learn tags do not award points.
- Educators:
  - Full LEAPS access; referral signup bonus (cap 50/month) awarded only when the referrer is an Educator: +2 points for inviting an Educator, +1 point for inviting a Student.

## API

- `POST /api/profile/onboarding` — Complete onboarding
- `GET /api/schools?q=…` — School autocomplete for Educators
