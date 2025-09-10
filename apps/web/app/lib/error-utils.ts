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
    const base: Pick<NormalizedError, 'name' | 'message'> = {
      name: err.name,
      message: err.message,
    }
    const withStack: Partial<Pick<NormalizedError, 'stack'>> =
      typeof err.stack === 'string' ? { stack: err.stack } : {}
    const withTrace: Partial<Pick<NormalizedError, 'traceId'>> =
      hasTraceId(err) && typeof err.traceId === 'string'
        ? { traceId: err.traceId }
        : {}
    return { ...base, ...withStack, ...withTrace }
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
