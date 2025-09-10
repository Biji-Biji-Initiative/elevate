---
title: Logging in Next.js Route Handlers
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [logging, nextjs, server]
---

## Logging in Next.js Route Handlers

Use `@elevate/logging/safe-server` in all Next.js route handlers to avoid worker transport errors and heavy pretty transports.

- Import: `import { getSafeServerLogger } from '@elevate/logging/safe-server'`
- Initialize in a handler: `const logger = await getSafeServerLogger('route-name')`
- Avoid: `@elevate/logging/server` in `apps/**/app/api/**` (ESLint enforces this).

Examples

- Route (good):

  ```ts
  export async function GET() {
    const logger = await getSafeServerLogger('metrics')
    logger.info('fetching metrics')
    // ...
  }
  ```

- Route (bad):
  ```ts
  import { getServerLogger } from '@elevate/logging/server' // forbidden in route handlers
  ```

Client vs Server

- Client components use lightweight console or client logger utilities.
- Server components and route handlers use `getSafeServerLogger` only.
