import type { ServerLogger } from './server'

/**
 * Returns a server logger configured safely for Next.js route handlers.
 * - Disables pretty transport to avoid worker DataClone issues
 * - Falls back to no-op logger if the logging module cannot load
 */
type SafeLogger = Pick<ServerLogger, 'info' | 'warn' | 'error'> & {
  forRequestWithHeaders?: (request: Request) => {
    info: (msg: string, ctx?: Record<string, unknown>) => void
    warn: (msg: string, ctx?: Record<string, unknown>) => void
    error: (msg: string, err?: Error, ctx?: Record<string, unknown>) => void
  }
}

export async function getSafeServerLogger(name?: string): Promise<SafeLogger> {
  try {
    const mod = await import('./server')
    return mod.getServerLogger({ pretty: false, name }) as SafeLogger
  } catch {
    const noop = (_?: unknown, __?: unknown, ___?: unknown) => { /* intentional no-op */ }
    const fallback: SafeLogger = {
      info: noop,
      warn: noop,
      error: noop,
      forRequestWithHeaders: (_request: Request) => ({
        info: noop,
        warn: noop,
        error: noop,
      }),
    }
    return fallback
  }
}
