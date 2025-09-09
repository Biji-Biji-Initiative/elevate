export function isError(value: unknown): value is Error {
  return value instanceof Error
}

export function handleApiError(err: unknown, context?: string): string {
  if (isError(err)) {
    return context ? `${context}: ${err.message}` : err.message
  }
  try {
    return context ? `${context}: ${JSON.stringify(err)}` : JSON.stringify(err)
  } catch {
    return context ? `${context}: Unknown error` : 'Unknown error'
  }
}

