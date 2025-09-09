Logging in Next.js Route Handlers

Overview
- Use lightweight, worker-safe logging inside Next.js route handlers.
- Avoid pretty transports and custom prettifiers that can cause DataCloneError in dev/edge workers.

Guidelines
- In route handlers (e.g., `apps/*/app/api/**/route.ts`), import the safe factory:
  - `import { getSafeServerLogger } from '@elevate/logging/safe-server'`
  - Then create a request-scoped logger where available:
    - `const base = await getSafeServerLogger('my-route')`
    - `const logger = base.forRequestWithHeaders ? base.forRequestWithHeaders(request) : base`
- Do not import `@elevate/logging/server` directly in route handlers.
  - ESLint enforces this via `no-restricted-imports`.

Rationale
- Next.js route handlers can run in worker-like contexts where cloning complex functions (e.g., pino-pretty customPrettifiers) is unsafe.
- The safe logger disables pretty transports and falls back to a no-op logger if logging cannot initialize.

Examples
- Web metrics route:
  - see `apps/web/app/api/metrics/route.ts` for the safe pattern.

