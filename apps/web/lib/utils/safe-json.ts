export function safeJsonParse<T = unknown>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined
  }
}
