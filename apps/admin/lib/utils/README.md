## Admin lib utils

- param-builder.ts

  - mergeOptional(obj, key, value): immutably add a key only when value is defined. Helps satisfy exactOptionalPropertyTypes without unsafe casts.
  - isOneOf(value, options): runtime guard to narrow string unions.
  - nonEmptyString(value): guard for present, non-empty strings.

- query.ts
  - buildQueryString(params): builds a URL query string from a record, skipping undefined/null values.
  - buildSearchParams(params): returns a URLSearchParams with the same skipping rules.

Usage guidelines

- Prefer mergeOptional when constructing service/action params to avoid including undefined keys.
- Prefer buildQueryString for UI URL construction instead of manual URLSearchParams; it centralizes filtering of empty values and improves readability.

Examples

- Build service params with mergeOptional (exactOptionalPropertyTypes-safe):

  const base = { page: 1, limit: 50, sortBy: 'created_at', sortOrder: 'desc' as const }
  let params = base
  params = mergeOptional(params, 'search', search || undefined)
  params = mergeOptional(params, 'role', role !== 'ALL' ? role : undefined)
  params = mergeOptional(params, 'userType', userType !== 'ALL' ? userType : undefined)
  // pass params to listUsersService(params)

- Build a clean query string for a link:

  import { buildQueryString } from '@/lib/utils/query'
  const qs = buildQueryString({ userId: id, cohort: cohort || undefined })
  const href = `/admin/audit?${qs}`
