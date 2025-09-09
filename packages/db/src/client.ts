import { PrismaClient, type Prisma } from '@prisma/client'

import {
  getSecureLogger,
  logSecureDatabaseQuery,
  PIIRedactor,
  LOG_CONFIG,
  type SecureLogContext,
} from './logger'

// Local fallback type for logging context to avoid missing optional logging package
export type LogContext = Record<string, unknown>

declare global {
  var prisma: PrismaClient | undefined
}

// Enhanced Prisma client with secure logging
const createPrismaClient = () => {
  // Configure Prisma logging based on environment and security requirements
  const logConfig = []

  // Always log errors for debugging
  logConfig.push({ emit: 'event' as const, level: 'error' as const })

  // Only log queries in development with explicit flag
  if (LOG_CONFIG.ENABLE_DB_LOGGING && process.env.NODE_ENV === 'development') {
    logConfig.push({ emit: 'event' as const, level: 'query' as const })
    logConfig.push({ emit: 'event' as const, level: 'info' as const })
    logConfig.push({ emit: 'event' as const, level: 'warn' as const })
  }

  const client = new PrismaClient({
    log: logConfig,
  })

  const secureLogger = getSecureLogger()

  // Set up secure logging event handlers
  client.$on('query', (e) => {
    // Only emit detailed query logs when explicitly enabled, and only for slow queries if threshold set
    if (!LOG_CONFIG.ENABLE_DB_LOGGING) return

    // Extract operation and table info safely without exposing PII
    const operation =
      e.query.match(/^(SELECT|INSERT|UPDATE|DELETE|WITH)/i)?.[1] || 'QUERY'
    const table =
      e.query.match(/FROM\s+(\w+)/i)?.[1] ||
      e.query.match(/UPDATE\s+(\w+)/i)?.[1] ||
      e.query.match(/INSERT\s+INTO\s+(\w+)/i)?.[1] ||
      'unknown_table'

    // Respect slow-query threshold
    const isSlow =
      typeof LOG_CONFIG.SLOW_QUERY_MS === 'number' &&
      LOG_CONFIG.SLOW_QUERY_MS > 0
        ? e.duration >= LOG_CONFIG.SLOW_QUERY_MS
        : true

    if (!isSlow) return

    const context: SecureLogContext = {
      operation: operation.toUpperCase(),
      table,
      duration: e.duration,
    }

    secureLogger.database(context, {
      target: e.target,
      // Never log actual query or params in production
      queryPreview:
        process.env.NODE_ENV === 'development'
          ? PIIRedactor.sanitizeSQLQuery(e.query).slice(
              0,
              LOG_CONFIG.MAX_QUERY_LOG_LENGTH,
            )
          : undefined,
    })
  })

  client.$on('error', (e) => {
    secureLogger.error('Database error occurred', e.message, {
      action: 'database_error',
      target: e.target,
    })
  })

  client.$on('info', (e) => {
    if (LOG_CONFIG.ENABLE_DB_LOGGING) {
      secureLogger.info('Database info', {
        action: 'database_info',
        target: e.target,
        message: PIIRedactor.redactPII(e.message),
      })
    }
  })

  client.$on('warn', (e) => {
    secureLogger.warn('Database warning', {
      action: 'database_warning',
      target: e.target,
      message: PIIRedactor.redactPII(e.message),
    })
  })

  return client
}

export const prisma = global.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

/**
 * Create a context-aware database wrapper for secure logging
 * This wrapper ensures no PII is logged and provides consistent error handling
 */
export function withDatabaseLogging<T>(
  operation: string,
  table?: string,
  _context?: LogContext,
) {
  return async (dbOperation: () => Promise<T>): Promise<T> => {
    const startTime = Date.now()

    try {
      const result = await dbOperation()
      const duration = Date.now() - startTime

      // Determine record count if result is an array (common for SELECT queries)
      let recordCount: number | undefined
      if (Array.isArray(result)) {
        recordCount = result.length
      } else if (result && typeof result === 'object' && 'count' in result) {
        recordCount = result.count as number
      }

      logSecureDatabaseQuery(
        operation,
        table,
        duration,
        true, // success
        recordCount,
      )

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      logSecureDatabaseQuery(
        operation,
        table,
        duration,
        false, // failed
        undefined,
        error,
      )

      // Re-throw the original error without modification
      throw error
    }
  }
}

/**
 * Secure database transaction wrapper
 * Provides logging and error handling for database transactions
 */
export async function withDatabaseTransaction<T>(
  operation: string,
  transactionFn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const startTime = Date.now()
  const secureLogger = getSecureLogger()

  try {
    const result = await prisma.$transaction(transactionFn)
    const duration = Date.now() - startTime

    secureLogger.database({
      operation: `TRANSACTION:${operation}`,
      duration,
    })

    return result
  } catch (error) {
    const duration = Date.now() - startTime

    secureLogger.error(`Database transaction failed: ${operation}`, error, {
      operation: `TRANSACTION:${operation}`,
      duration,
    })

    throw error
  }
}
