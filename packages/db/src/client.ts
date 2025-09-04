import { PrismaClient } from '@prisma/client'

// Local fallback type for logging context to avoid missing optional logging package
export type LogContext = Record<string, unknown>

// Dynamic logger initialization
let logger: any = null

// Initialize logger asynchronously in Node.js environment
const initializeLogger = async () => {
  // Optional dependency: if an internal logging package exists at runtime, use it; otherwise no-op
  if (
    typeof window === 'undefined' &&
    typeof process !== 'undefined' &&
    !logger
  ) {
    try {
      // Dynamically import only at runtime; keep untyped to avoid type resolution on optional package
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mod = await import('@elevate/logging/server')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const getServerLoggerLocal = (mod as any).getServerLogger
      if (typeof getServerLoggerLocal === 'function') {
        logger = getServerLoggerLocal({ name: 'elevate-db' })
      }
    } catch {
      // Fallback to console if logging not available
      // Intentionally silent
    }
  }
}

// Initialize logger
initializeLogger().catch(() => {
  // Silent catch - fallback to console logging
})

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Enhanced Prisma client with logging
const createPrismaClient = () => {
  const client = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  })

  // Set up logging event handlers if logger is available
  if (logger) {
    client.$on('query', (e) => {
      logger.database({
        operation: 'query',
        query: e.query,
        params: e.params,
        duration: e.duration,
        target: e.target,
      })
    })

    client.$on('error', (e) => {
      logger.error('Database error', new Error(e.message), {
        action: 'database_error',
        target: e.target,
      })
    })

    client.$on('info', (e) => {
      logger.info(`Database info: ${e.message}`, {
        action: 'database_info',
        target: e.target,
      })
    })

    client.$on('warn', (e) => {
      logger.warn(`Database warning: ${e.message}`, {
        action: 'database_warning',
        target: e.target,
      })
    })
  } else {
    // Fallback to console logging
    client.$on('error', (e) => {
      console.error('Database error:', e)
    })

    if (process.env.NODE_ENV === 'development') {
      client.$on('query', (e) => {
        console.log(`Query: ${e.query} | Duration: ${e.duration}ms`)
      })
    }
  }

  return client
}

export const prisma = global.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

/**
 * Create a context-aware database wrapper for logging
 */
export function withDatabaseLogging<T>(
  operation: string,
  table?: string,
  context?: LogContext,
) {
  return async (dbOperation: () => Promise<T>): Promise<T> => {
    const startTime = Date.now()

    try {
      const result = await dbOperation()
      const duration = Date.now() - startTime

      if (logger) {
        logger.database(
          {
            operation,
            table,
            duration,
          },
          context,
        )
      } else if (process.env.NODE_ENV === 'development') {
        console.log(
          `DB ${operation}${
            table ? ` on ${table}` : ''
          } completed in ${duration}ms`,
        )
      }

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      if (logger) {
        logger.database(
          {
            operation,
            table,
            duration,
            error: error instanceof Error ? error.message : String(error),
          },
          context,
        )
      } else {
        console.error(
          `DB ${operation}${
            table ? ` on ${table}` : ''
          } failed after ${duration}ms:`,
          error,
        )
      }

      throw error
    }
  }
}
