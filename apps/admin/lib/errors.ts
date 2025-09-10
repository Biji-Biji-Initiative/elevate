export function toMsg(context: string, err: unknown): string {
  if (err instanceof Error) return `${context}: ${err.message}`
  if (typeof err === 'string') return `${context}: ${err}`
  if (typeof err === 'number' || typeof err === 'boolean')
    return `${context}: ${String(err)}`
  if (err && typeof err === 'object') {
    try {
      return `${context}: ${JSON.stringify(err as Record<string, unknown>)}`
    } catch {
      return `${context}: Unknown error`
    }
  }
  return `${context}: Unknown error`
}
