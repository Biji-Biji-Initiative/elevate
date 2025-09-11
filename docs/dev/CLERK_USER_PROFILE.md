# Clerk User Profile — Integration Guide

This app uses Clerk’s `UserProfile` component for account management and embeds a LEAPS profile tab for role/school/region.

## Routes

- Account: `/{locale}/account` — renders `UserProfile` with brand appearance, quick links, and a custom LEAPS tab.
- LEAPS form: Embedded page posts to `POST /api/profile/onboarding` to update `user_type`, `school`, `region`.

## Customization

- Appearance: Set theme variables and element classes via the `appearance` prop.
- Links: Add `UserProfile.Link` items for Dashboard, Invite, etc.
- Pages: Define `UserProfile.Page` to host your own React content.
- Localization: Provide `enUS`/`idID` via `<ClerkProvider localization={...}>` in `apps/web/app/[locale]/layout.tsx`.

## Guardrails

- LEAPS fields are not user-editable via default Clerk tabs; only via our custom page.
- `user_type` is mirrored to Clerk `publicMetadata.user_type` for parity; database remains source of truth.

## Admin Deep Links

- Optional: Set `NEXT_PUBLIC_CLERK_DASHBOARD_URL` in Admin `.env` to enable “Open in Clerk” links in the Users table.

```
NEXT_PUBLIC_CLERK_DASHBOARD_URL=https://dashboard.clerk.com/apps/<your_app_id>
```

