export function toMsg(context: string, err: unknown): string {
  if (err instanceof Error) return `${context}: ${err.message}`
  try {
    return `${context}: ${JSON.stringify(err)}`
  } catch {
    return `${context}: Unknown error`
  }
}

