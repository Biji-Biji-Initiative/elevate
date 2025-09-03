import type { z } from 'zod'

export class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'HttpError'
  }
}

export async function typedFetch<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  schema: z.ZodType<T>
): Promise<T> {
  const res = await fetch(input, init)
  
  // Safely handle JSON parsing with proper error handling
  let json: unknown
  try {
    json = await res.json()
  } catch (_error) {
    // If JSON parsing fails, provide empty object for error extraction
    json = {}
  }

  if (!res.ok) {
    // Type-safe error message extraction
    let message = res.statusText
    if (json && typeof json === 'object' && 'error' in json && typeof json.error === 'string') {
      message = json.error
    }
    throw new HttpError(message || 'Request failed', res.status)
  }

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new Error(`Response validation failed: ${parsed.error.message}`)
  }
  return parsed.data
}
