// Small helpers to construct parameter objects without undefined keys
// and with simple runtime validations. These helpers centralize patterns
// needed to satisfy exactOptionalPropertyTypes without unsafe casts.

export function mergeOptional<T extends object, K extends string, V>(
  obj: T,
  key: K,
  value: V | undefined,
): T {
  if (value === undefined) return obj
  return { ...(obj as Record<string, unknown>), [key]: value } as unknown as T
}

export function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
}

export function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
