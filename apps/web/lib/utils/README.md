## Web utils

- query.ts
  - buildQueryString(params): builds a query string from a record, skipping undefined/null.
  - buildSearchParams(params): returns URLSearchParams with the same skipping behavior.

Usage example

import { buildQueryString } from '@/lib/utils/query'
const qs = buildQueryString({ q: search || undefined, limit: 10 })
const res = await fetch(`/api/schools?${qs}`)
