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

Refer to `docs/DEV_TROUBLESHOOTING.md` for additional patterns and common resolutions.
