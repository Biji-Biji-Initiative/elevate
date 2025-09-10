## SSR Patterns and Server Base URLs

Goals

- Build absolute base URLs in server code from request headers.
- Keep client code on same-origin relative paths.
- Ensure metadataBase is correct for Next.js 15 apps.

Server baseUrl

- Use `next/headers` to read `x-forwarded-proto` and `x-forwarded-host` (or `host`).
- Derive `baseUrl` as `"${proto}://${host}"`.
- Example (web and admin share the same pattern):

```ts
import { headers } from 'next/headers'
import { ElevateAPIClient } from '@elevate/openapi/sdk'

export async function getServerApiClient(token?: string) {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') || 'http'
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  return new ElevateAPIClient({ baseUrl: `${proto}://${host}`, token })
}
```

Client baseUrl

- On the client (browser), pass an empty string for `baseUrl` to use same-origin paths.
- Use a single helper that chooses `''` in the browser and falls back to env/server helpers on the server.

metadataBase

- In `app/layout.tsx`, compute `metadataBase` asynchronously from headers.

```ts
export async function generateMetadata() {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') || 'http'
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  return { metadataBase: new URL(`${proto}://${host}`) }
}
```

Caching

- For GET APIs, set explicit `Cache-Control` headers with `s-maxage` and optional `stale-while-revalidate`.
- Example: `public, s-maxage=300, stale-while-revalidate=600`.
