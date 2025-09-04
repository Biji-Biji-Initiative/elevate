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

  let json: unknown
  try {
    json = await res.json()
  } catch (error) {
    // Failed to parse JSON response, likely empty or non-JSON content
    console.warn('Failed to parse JSON response:', error instanceof Error ? error.message : 'Unknown error')
    json = {}
  }

  if (!res.ok) {
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

