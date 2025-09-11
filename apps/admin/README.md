# Elevate Admin App (Next.js 15)

This app is the reviewer/administrator console. It follows repo-wide build rules in BUILDING.md. Key integration notes below prevent common pitfalls.

## Internationalization (next-intl v4)
- Provider placement: `NextIntlClientProvider` is created in `app/layout.tsx` (server component) using `getMessages()`.
- Do not add another provider in `[locale]/layout.tsx`; the root provider already wraps the app.
- Client components can safely use `useTranslations(...)` anywhere under `app/layout.tsx`.

Example (already implemented):

```tsx
// app/layout.tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages()
  return (
    <html lang="en">
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
```

## Clerk Middleware Context
- `middleware.ts` calls `await auth()` for all non-static requests to initialize Clerk context.
- Keep public-route checks and i18n in middleware; API routes continue to enforce auth explicitly.

## Dev Ports
- `pnpm -C elevate dev` launches admin via `apps/admin/scripts/dev.js`, which picks the first free port starting at `3001` (override with `ADMIN_PORT`/`PORT`).

## Turbopack & Tracing
- `turbopack.root` and `outputFileTracingRoot` are aligned to the monorepo root to avoid root inference issues.

## Boundaries & Imports
- Import only declared subpaths (e.g., `@elevate/auth`, `@elevate/ui`).
- Do not import deep internals or `dist/` outputs.
- Keep server-only modules out of client components.

### Dashboard split (server + client)
- `[locale]/page.tsx` is now a server component that loads initial analytics and cohorts via `apps/admin/lib/services/*` and renders a client shell.
- `[locale]/ClientPage.tsx` contains the interactive UI and calls server actions like `lib/actions/analytics.getAnalyticsAction` to fetch on-demand.
- Avoid importing `@elevate/admin-core` in client components; use services and actions instead.

Refer to `docs/DEV_TROUBLESHOOTING.md` for additional patterns and common resolutions.

## Server-First Patterns (Admin)

The Admin app uses server-only services and pure mappers to avoid intra-app HTTP and keep DTOs consistent.

- Services (apps/admin/lib/server/*-service.ts)
  - Enforce authorization with `requireRole('...')`
  - Parse inputs via Zod where needed
  - Fetch via `@elevate/db`
  - Map rows → DTOs via `lib/server/mappers.ts`
  - Validate final DTO once with Zod and return typed data

- Mappers (apps/admin/lib/server/mappers.ts)
  - Pure, minimal-typed functions that normalize dates and apply defaults
  - One Zod parse at the boundary (e.g., AdminSubmissionSchema)
  - Central place to evolve DTO shape safely

- Actions (apps/admin/lib/actions/*.ts)
  - Thin wrappers for client calls; no cross-app `fetch`
  - Compose parameters, call services directly

Example (Adding a new admin endpoint):
1. Create a `*-service.ts` function with `requireRole`, input parsing, and DB calls
2. Add a mapper for rows → DTO (validate with Zod once at return)
3. Expose a thin action for UI (if needed)
4. Optional: add a small mapper unit test under `apps/admin/__tests__`

See also `lib/server/README.md` for more details.
