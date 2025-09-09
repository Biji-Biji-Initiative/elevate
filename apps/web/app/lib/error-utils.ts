export type NormalizedError = {
  name: string
  message: string
  stack?: string
  traceId?: string
}

export function hasTraceId(value: unknown): value is { traceId?: string } {
  return typeof value === 'object' && value !== null && 'traceId' in value
}

export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof Error) {
    const base: NormalizedError = {
      name: err.name,
      message: err.message,
      stack: err.stack,
    }
    if (hasTraceId(err)) base.traceId = err.traceId
    return base
  }
  return {
    name: 'Error',
    message: typeof err === 'string' ? err : JSON.stringify(err),
  }
}

export function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  try {
    return typeof err === 'string' ? err : JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

export function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  try {
    return typeof err === 'string' ? err : JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}
