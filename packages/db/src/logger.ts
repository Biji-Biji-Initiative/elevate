/**
 * Secure logging utilities with PII redaction and structured logging
 * Ensures sensitive data is never logged in production environments
 */

import type { ServerLogger, LogLevel as LoggingLogLevel } from '@elevate/logging/server'

export interface LogLevel {
  ERROR: 'error'
  WARN: 'warn'
  INFO: 'info'
  DEBUG: 'debug'
  DATABASE: 'database'
}

export interface SecureLogContext extends Record<string, unknown> {
  operation?: string
  table?: string | undefined
  duration?: number
  userId?: string
  recordCount?: number | undefined
  error?: string | undefined
  // Never include: query parameters, full SQL queries, or raw error objects
}

/**
 * PII redaction patterns and utilities
 */
export class PIIRedactor {
  private static readonly EMAIL_PATTERN = /[\w.-]+@[\w.-]+\.\w+/gi
  private static readonly PHONE_PATTERN = /[+]?[()]?[\d\s\-()]{10,}/g
  private static readonly IP_PATTERN = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g
  private static readonly TOKEN_PATTERN =
    /(?:token|key|secret|password|auth|bearer)['":\s]*['"=\s]*([a-zA-Z0-9+/=_.-]{10,})/gi
  private static readonly JWT_PATTERN =
    /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g
  private static readonly BASE64_PATTERN = /\b[A-Za-z0-9+/]{20,}={0,2}\b/g
  private static readonly ID_PATTERN =
    /(?:user_id|id)['":\s]*['"=\s]*([a-zA-Z0-9_-]{8,})/gi

  // Common Indonesian names and sensitive fields
  private static readonly NAME_PATTERNS = [
    // Don't redact these as they're too generic, but be aware
    /(?:name|nama)['":\s]*['"=\s]*([A-Za-z\s]{2,})/gi,
    /(?:firstName|lastName|fullName)['":\s]*['"=\s]*([A-Za-z\s]{2,})/gi,
  ]

  /**
   * Redact PII from any string (logs, queries, error messages)
   */
  static redactPII(text: string | null | undefined): string | null | undefined {
    if (!text || typeof text !== 'string') {
      return text
    }

    const redacted = text
      // Email addresses
      .replace(this.EMAIL_PATTERN, '[EMAIL_REDACTED]')
      // Phone numbers
      .replace(this.PHONE_PATTERN, '[PHONE_REDACTED]')
      // IP addresses
      .replace(this.IP_PATTERN, '[IP_REDACTED]')
      // JWT tokens (3-part dot-separated base64)
      .replace(this.JWT_PATTERN, '[JWT_REDACTED]')
      // Base64 encoded strings
      .replace(this.BASE64_PATTERN, '[BASE64_REDACTED]')
      // Tokens, keys, passwords
      .replace(this.TOKEN_PATTERN, (match, captured) =>
        typeof captured === 'string' 
          ? match.replace(captured, '[SENSITIVE_REDACTED]')
          : match,
      )
      // User IDs (keep first 4 chars for debugging)
      .replace(this.ID_PATTERN, (match, captured) =>
        typeof captured === 'string'
          ? match.replace(captured, captured.slice(0, 4) + '****')
          : match,
      )

    return redacted
  }

  /**
   * Redact SQL query parameters that might contain PII
   */
  static redactSQLParams(params: unknown): unknown[] {
    if (!Array.isArray(params)) {
      return []
    }

    return params.map((param, index) => {
      if (typeof param === 'string') {
        // If it looks like an email, phone, or long ID, redact it
        if (this.EMAIL_PATTERN.test(param)) {
          return '[EMAIL_REDACTED]'
        }
        if (this.PHONE_PATTERN.test(param)) {
          return '[PHONE_REDACTED]'
        }
        if (param.length > 10 && /^[a-zA-Z0-9_-]+$/.test(param)) {
          return `${param.slice(0, 4)}****`
        }
        // For other strings, check if they contain names or sensitive data
        return this.redactPII(param)
      }

      // Numbers and booleans are generally safe to log
      if (typeof param === 'number' || typeof param === 'boolean') {
        return param
      }

      // For objects, don't log them at all in production
      if (typeof param === 'object' && param !== null) {
        return process.env.NODE_ENV === 'development'
          ? JSON.stringify(param).slice(0, 100) + '...'
          : '[OBJECT_REDACTED]'
      }

      return `[PARAM_${index}_REDACTED]`
    })
  }

  /**
   * Create a sanitized error object safe for logging
   */
  static sanitizeError(error: unknown): {
    message: string
    name?: string
    code?: string | number | undefined
    stack?: string | undefined
  } {
    if (error instanceof Error) {
      return {
        message: this.redactPII(error.message) ?? 'Unknown error message',
        name: error.name,
        code: 'code' in error ? (error.code as string | number) : undefined,
        // Include stack trace only in development
        stack:
          process.env.NODE_ENV === 'development'
            ? this.redactPII(error.stack || '') ?? undefined
            : undefined,
      }
    }

    if (typeof error === 'string') {
      return { message: this.redactPII(error) ?? 'Unknown error' }
    }

    return { message: 'Unknown error occurred' }
  }

  /**
   * Safe SQL query logging - removes parameters and sensitive data
   */
  static sanitizeSQLQuery(query: unknown): string {
    if (!query || typeof query !== 'string') {
      return '[INVALID_QUERY]'
    }

    // Remove common PII-containing WHERE clauses
    let sanitized = query
      // Replace specific user IDs in WHERE clauses
      .replace(
        /WHERE\s+[\w.]*user_id\s*=\s*\$\d+/gi,
        'WHERE user_id = [REDACTED]',
      )
      .replace(/WHERE\s+[\w.]*email\s*=\s*\$\d+/gi, 'WHERE email = [REDACTED]')
      .replace(/WHERE\s+[\w.]*id\s*=\s*\$\d+/gi, 'WHERE id = [REDACTED]')
      // Replace parameter placeholders
      .replace(/\$\d+/g, '[PARAM]')
    // General PII redaction
    sanitized = this.redactPII(sanitized) ?? sanitized

    // In production, further simplify to just operation type
    if (process.env.NODE_ENV === 'production') {
      const operation =
        sanitized.match(/^(SELECT|INSERT|UPDATE|DELETE|WITH)/i)?.[1] || 'QUERY'
      const table =
        sanitized.match(/FROM\s+(\w+)/i)?.[1] ||
        sanitized.match(/UPDATE\s+(\w+)/i)?.[1] ||
        sanitized.match(/INSERT\s+INTO\s+(\w+)/i)?.[1] ||
        'unknown_table'
      return `${operation} ${table} [QUERY_SANITIZED]`
    }

    return sanitized
  }
}

/**
 * Secure database logger with environment-aware configuration
 */
export class SecureDatabaseLogger {
  private static instance: SecureDatabaseLogger
  private logger: ServerLogger | null = null
  private logLevel: keyof LogLevel = 'INFO'

  constructor() {
    void this.initializeLogger()
    this.setLogLevel()
  }

  static getInstance(): SecureDatabaseLogger {
    if (!this.instance) {
      this.instance = new SecureDatabaseLogger()
    }
    return this.instance
  }

  private async initializeLogger() {
    // Skip logger initialization in browser environments
    if (typeof window !== 'undefined') {
      return
    }

    try {
      type LoggingModule = {
        getServerLogger: (config: { name?: string; level?: LoggingLogLevel; pretty?: boolean }) => ServerLogger
      }
      const mod: unknown = await import('@elevate/logging/server')
      const { getServerLogger } = mod as LoggingModule
      const levelMap: Record<keyof LogLevel, LoggingLogLevel> = {
        ERROR: 'error',
        WARN: 'warn',
        INFO: 'info',
        DEBUG: 'debug',
        DATABASE: 'debug',
      }
      this.logger = getServerLogger({
        name: 'elevate-db',
        level: levelMap[this.logLevel],
        pretty: false, // Avoid pretty transports in worker contexts
      })
    } catch {
      // Fallback to console logging with structured format
      this.logger = null
    }
  }

  private setLogLevel() {
    const envLevel = process.env.DB_LOG_LEVEL?.toUpperCase() as keyof LogLevel

    // Set appropriate log level based on environment
    if (process.env.NODE_ENV === 'production') {
      this.logLevel = envLevel || 'ERROR' // Production: errors only by default
    } else if (process.env.NODE_ENV === 'test') {
      this.logLevel = 'WARN' // Test: warnings and errors
    } else {
      this.logLevel = envLevel || 'DEBUG' // Development: debug info by default
    }
  }

  private shouldLog(level: keyof LogLevel): boolean {
    const levels: Record<keyof LogLevel, number> = {
      ERROR: 1,
      WARN: 2,
      INFO: 3,
      DEBUG: 4,
      DATABASE: 4, // Same as DEBUG
    }

    return levels[level] <= levels[this.logLevel]
  }

  /**
   * Log database operations with PII redaction
   */
  database(
    context: SecureLogContext,
    additionalContext?: Record<string, unknown>,
  ) {
    if (!this.shouldLog('DATABASE')) return

    const safeContext = {
      ...context,
      operation: context.operation ?? 'unknown',
      table: context.table ?? 'unknown',
      // Remove any potential PII from context
      userId: context.userId ? `${context.userId.slice(0, 4)}****` : undefined,
      // Ensure error messages are redacted
      error: context.error ? (PIIRedactor.redactPII(context.error) ?? '') : '',
      duration: context.duration ?? 0,
      recordCount: context.recordCount ?? 0,
    }

    if (this.logger) {
      this.logger.database(safeContext, additionalContext)
    } else {
      this.consoleLog('DATABASE', safeContext, additionalContext)
    }
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    if (!this.shouldLog('ERROR')) return

    const sanitizedError = error ? PIIRedactor.sanitizeError(error) : undefined
    const safeMessage = PIIRedactor.redactPII(message) ?? message

    if (this.logger) {
      this.logger.error(safeMessage, sanitizedError, context)
    } else {
      this.consoleLog(
        'ERROR',
        { message: safeMessage, error: sanitizedError },
        context,
      )
    }
  }

  warn(message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog('WARN')) return

    const safeMessage = PIIRedactor.redactPII(message) ?? message

    if (this.logger) {
      this.logger.warn(safeMessage, context)
    } else {
      this.consoleLog('WARN', { message: safeMessage }, context)
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog('INFO')) return

    const safeMessage = PIIRedactor.redactPII(message) ?? message

    if (this.logger) {
      this.logger.info(safeMessage, context)
    } else {
      this.consoleLog('INFO', { message: safeMessage }, context)
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog('DEBUG')) return

    const safeMessage = PIIRedactor.redactPII(message) ?? message

    if (this.logger) {
      this.logger.debug(safeMessage, context)
    } else {
      this.consoleLog('DEBUG', { message: safeMessage }, context)
    }
  }

  private consoleLog(
    level: string,
    data: Record<string, unknown>,
    context?: Record<string, unknown>,
  ) {
    // Structured console logging for fallback
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      service: 'elevate-db',
      ...data,
      ...(context && { context }),
    }

    const payload = JSON.stringify(logEntry, null, 2)
    if (level === 'ERROR') {
      console.error(payload)
    } else if (level === 'WARN') {
      console.warn(payload)
    } else {
      console.log(payload)
    }
  }
}

/**
 * Get the secure database logger instance
 */
export const getSecureLogger = () => SecureDatabaseLogger.getInstance()

/**
 * Log database query with security measures
 * This replaces the unsafe query logging in the original client
 */
export function logSecureDatabaseQuery(
  operation: string,
  table: string | undefined,
  duration: number,
  success: boolean,
  recordCount?: number,
  error?: unknown,
) {
  const logger = getSecureLogger()

  const context: SecureLogContext = {
    operation,
    table,
    duration,
    recordCount: recordCount || 0,
    error: error ? PIIRedactor.sanitizeError(error).message : undefined,
  }

  if (success) {
    logger.database(context)
  } else {
    logger.error(`Database operation failed: ${operation}`, error, context)
  }
}

/**
 * Environment configuration for logging
 */
export const LOG_CONFIG = {
  // Never log SQL parameters in production
  LOG_QUERY_PARAMETERS:
    process.env.NODE_ENV === 'development' &&
    process.env.DB_LOG_QUERY_PARAMS === 'true',

  // Log query execution times
  LOG_QUERY_DURATION: process.env.DB_LOG_DURATION !== 'false',

  // Log query count/performance metrics
  LOG_PERFORMANCE_METRICS: process.env.DB_LOG_PERFORMANCE !== 'false',

  // Maximum query length to log (prevent massive queries in logs)
  MAX_QUERY_LOG_LENGTH: parseInt(process.env.DB_MAX_QUERY_LOG_LENGTH || '200'),

  // Enable detailed database logging
  ENABLE_DB_LOGGING: process.env.DB_LOGGING !== 'false',
}
