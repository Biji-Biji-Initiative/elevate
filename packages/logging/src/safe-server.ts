import type { ServerLogger } from './server'

/**
 * Returns a server logger configured safely for Next.js route handlers.
 * - Disables pretty transport to avoid worker DataClone issues
 * - Falls back to no-op logger if the logging module cannot load
 */
type MethodSubset =
  | 'info'
  | 'warn'
  | 'error'
  | 'debug'
  | 'fatal'
  | 'security'
  | 'api'
  | 'database'
  | 'audit'
  | 'performance'
  | 'auth'
  | 'webhook'

export type SafeLogger = Pick<ServerLogger, MethodSubset> & {
  forRequestWithHeaders?: (request: Request) => Pick<ServerLogger, MethodSubset>
}

const noop = (_?: unknown, __?: unknown, ___?: unknown) => {
  /* intentional no-op */
}

const fallback: SafeLogger = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  fatal: noop,
  security: (..._args: unknown[]) => {
    noop()
  },
  api: (..._args: unknown[]) => {
    noop()
  },
  database: (..._args: unknown[]) => {
    noop()
  },
  audit: (..._args: unknown[]) => {
    noop()
  },
  performance: (..._args: unknown[]) => {
    noop()
  },
  auth: (..._args: unknown[]) => {
    noop()
  },
  webhook: (..._args: unknown[]) => {
    noop()
  },
  forRequestWithHeaders: (
    _request: Request,
  ): Pick<ServerLogger, MethodSubset> => ({
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    fatal: noop,
    security: (..._args: unknown[]) => {
      noop()
    },
    api: (..._args: unknown[]) => {
      noop()
    },
    database: (..._args: unknown[]) => {
      noop()
    },
    audit: (..._args: unknown[]) => {
      noop()
    },
    performance: (..._args: unknown[]) => {
      noop()
    },
    auth: (..._args: unknown[]) => {
      noop()
    },
    webhook: (..._args: unknown[]) => {
      noop()
    },
  }),
}

export async function getSafeServerLogger(name?: string): Promise<SafeLogger> {
  // Runtime-aware: only load the heavy server logger when clearly on Node
  try {
    const isEdge =
      typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime !== 'undefined'
    const isNode = typeof process !== 'undefined' && !!process.versions?.node
    const nextRuntime =
      (typeof process !== 'undefined' && process.env?.NEXT_RUNTIME) || undefined

    if (
      !isEdge &&
      isNode &&
      (nextRuntime === undefined || nextRuntime === 'nodejs')
    ) {
      const mod = await import('./server')
      const base: ServerLogger = mod.getServerLogger({ pretty: false })
      const logger = name ? base.child({ module: name }) : base
      // Narrow surface to SafeLogger methods
      return logger as SafeLogger
    }
  } catch {
    // fall through to fallback
  }
  return fallback
}
