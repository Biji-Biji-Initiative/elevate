# Elevate Web App

This is the public Web app (Next.js 15, App Router, React 19). It uses server-only services for SSR pages and client-safe API routes for mutations.

## Client vs Server imports for Security

- Client components/pages must use client-safe subpaths:
  - `@elevate/security/constants` for `CSRF_TOKEN_HEADER`, `CSRF_COOKIE_NAME`.
- Server route handlers/components can use root or server subpaths:
  - `@elevate/security`, `@elevate/security/csrf`, `@elevate/security/security-middleware`.

The repo’s ESLint rules enforce this boundary to prevent bundling `next/headers` into client bundles.

## Local Fonts (Inter, offline-friendly)

To ensure consistent typography without Google Fonts at build time, the app supports `next/font/local`:

1. Place Inter variable font at `apps/web/app/fonts/Inter-Variable.woff2`
2. Set `NEXT_USE_LOCAL_FONTS=true` in your env
3. Build or run dev — the root layout will apply the local font (`display: swap`) automatically

If not set, the app falls back to the system font stack (still offline-safe).

## SSR No-Fetch

Server-rendered pages fetch data via internal services (no intra-app HTTP):
- `app/[locale]/u/[handle]/page.tsx` → `@elevate/app-services`
- `app/[locale]/metrics/[stage]/page.tsx` → `@elevate/app-services`

Client pages use public API routes with standard envelopes and CSRF protection.

