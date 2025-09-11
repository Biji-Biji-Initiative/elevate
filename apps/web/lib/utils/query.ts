export type QueryValue = string | number | boolean | null | undefined

export function buildQueryString(params: Record<string, QueryValue>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    qs.set(key, String(value))
  }
  return qs.toString()
}

export function buildSearchParams(params: Record<string, QueryValue>): URLSearchParams {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    qs.set(key, String(value))
  }
  return qs
}

