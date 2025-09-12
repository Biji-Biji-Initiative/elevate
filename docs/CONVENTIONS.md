## Code Conventions (Admin & Web)

Core patterns

- buildQueryString: Build URL query strings by skipping undefined/null.

  - Admin: '@/lib/utils/query'
  - Web: '@/lib/utils/query'
  - Use for all client-side link/query construction, not manual string concat.

- safeJsonParse: Parse fetch responses safely.

  - Web: '@/lib/utils/safe-json'
  - Prefer text() then safeJsonParse<T>(text) to avoid throwing JSON.parse.

- exactOptionalPropertyTypes: Avoid adding undefined keys.

  - Use mergeOptional (Admin) when building objects conditionally.
  - Include optional fields only when present (conditional object spreads).

- Server services as single source of truth (Admin):

  - apps/admin/lib/server/\* are the domain services.
  - Actions/SSR helpers call services directly; no intra-app HTTP.

- Next 15 Page props: params/searchParams as Promise in some build workers.
  - Await props before accessing fields.

Examples

- Query string:
  const qs = buildQueryString({ search: q || undefined, limit: 10 })
  const res = await fetch(`/api/schools?${qs}`)

- Safe JSON:
  const text = await res.text()
  const parsed = safeJsonParse<{ data?: Item[] }>(text)
  const items = parsed?.data ?? []

- Optional fields (Admin):
  let params = { page, limit, sortBy, sortOrder }
  if (role !== 'ALL') params = { ...params, role }
  // Call service with params

Testing

- Prefer Response.text + JSON.parse in tests. Use `apps/web/tests/test-utils.ts#readJson` to avoid `res.json()` throwing when handlers sometimes return non-JSON during errors.
