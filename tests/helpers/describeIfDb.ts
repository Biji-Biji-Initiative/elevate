import { describe, it } from 'vitest'

function hasDbUrl(): boolean {
  return Boolean(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL)
}

function isSkip(): boolean {
  const flag = String(process.env.SKIP_DB_TESTS || '').toLowerCase()
  return flag === '1' || flag === 'true'
}

export const describeIfDb: typeof describe = ((name: string, fn: Parameters<typeof describe>[1], timeout?: number) => {
  if (isSkip() || !hasDbUrl()) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return describe.skip(name, () => {}, timeout as any)
  }
  return describe(name, fn, timeout as any)
}) as any

export const itIfDb: typeof it = ((name: string, fn: Parameters<typeof it>[1], timeout?: number) => {
  if (isSkip() || !hasDbUrl()) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return it.skip(name, () => {}, timeout as any)
  }
  return it(name, fn, timeout as any)
}) as any

