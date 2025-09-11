import type { z } from 'zod'

export function hasProp<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj
}

export async function parseEnvelope<T>(
  schema: z.ZodType<{ success: true; data: T }>,
  res: Response,
  action: string,
): Promise<T> {
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  const parsed = schema.safeParse(json)
  if (!res.ok || !parsed.success) {
    const err = hasProp(json, 'error') && typeof (json as Record<string, unknown>).error === 'string'
      ? String((json as Record<string, unknown>).error)
      : `${action} failed (${res.status})`
    throw new Error(err)
  }
  return parsed.data.data
}
