import type { LogContext, LoggerConfig, LogLevel, ErrorInfo } from './types.js'
import { serializeError, generateTraceId, mergeContexts } from './utils.js'

/**
 * Client-side logger for browser environments
 * Uses a simplified approach without Pino since it's Node.js specific
 */
export class ClientLogger {
  private config: {
    level: LogLevel
    name: string
    enabled: boolean
  }
  private baseContext?: LogContext

  constructor(config?: Partial<LoggerConfig>, baseContext?: LogContext) {
    this.config = {
      level: config?.level || 'info',
      name: config?.name || 'elevate-client',
      enabled: typeof window !== 'undefined' && process.env.NODE_ENV !== 'production',
    }
    if (baseContext) {
      this.baseContext = baseContext
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): ClientLogger {
    return new ClientLogger(this.config, mergeContexts(this.baseContext, context))
  }

  /**
   * Update the base context for this logger instance
   */
  setContext(context: LogContext): void {
    this.baseContext = mergeContexts(this.baseContext, context)
  }

  /**
   * Check if logging is enabled and level is sufficient
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false

    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
    const currentLevelIndex = levels.indexOf(this.config.level)
    const targetLevelIndex = levels.indexOf(level)

    return targetLevelIndex >= currentLevelIndex
  }

  /**
   * Format log entry for browser console
   */
  private formatLogEntry(
    level: LogLevel,
    message: string,
    error?: ErrorInfo,
    context?: LogContext
  ): [string, any] {
    const timestamp = new Date().toISOString()
    const ctx = mergeContexts(this.baseContext, context)
    
    const prefix = `[${timestamp}] ${this.config.name} ${level.toUpperCase()}`
    const formattedMessage = `${prefix}: ${message}`

    const data: {
      level: string;
      timestamp: string;
      message: string;
      context?: LogContext;
      error?: Error;
    } = {
      level,
      timestamp,
      message,
    }

    if (ctx) {
      data.context = ctx
    }

    if (error) {
      data.error = error
    }

    return [formattedMessage, data]
  }

  /**
   * Send log to browser console
   */
  private log(level: LogLevel, message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog(level)) return

    const errorInfo = error ? serializeError(error, context) : undefined
    const [formattedMessage, data] = this.formatLogEntry(level, message, errorInfo, context)

    // Use appropriate console method
    switch (level) {
      case 'fatal':
      case 'error':
        console.error(formattedMessage, data)
        break
      case 'warn':
        console.warn(formattedMessage, data)
        break
      case 'debug':
        console.debug(formattedMessage, data)
        break
      case 'trace':
        console.trace(formattedMessage, data)
        break
      default:
        console.log(formattedMessage, data)
    }
  }

  // Standard logging methods
  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    this.log('fatal', message, error, context)
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.log('error', message, error, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, undefined, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, undefined, context)
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, undefined, context)
  }

  trace(message: string, context?: LogContext): void {
    this.log('trace', message, undefined, context)
  }

  /**
   * Log user interactions
   */
  userAction(action: string, details?: Record<string, unknown>, context?: LogContext): void {
    this.info(`User action: ${action}`, {
      ...context,
      action: 'user_interaction',
      details,
    })
  }

  /**
   * Log navigation events
   */
  navigation(from: string, to: string, context?: LogContext): void {
    this.info(`Navigation: ${from} → ${to}`, {
      ...context,
      action: 'navigation',
      from,
      to,
    })
  }

  /**
   * Log API calls from client
   */
  apiCall(
    method: string,
    url: string,
    status?: number,
    duration?: number,
    context?: LogContext
  ): void {
    const level = status && status >= 400 ? 'error' : 'info'
    const message = `API ${method} ${url}${status ? ` ${status}` : ''}${duration ? ` (${duration}ms)` : ''}`
    
    this.log(level, message, undefined, {
      ...context,
      action: 'api_call',
      method,
      url,
      status,
      duration,
    })
  }

  /**
   * Log React errors
   */
  reactError(error: Error, errorInfo: { componentStack: string }, context?: LogContext): void {
    this.error('React error', error, {
      ...context,
      action: 'react_error',
      componentStack: errorInfo.componentStack,
    })
  }

  /**
   * Create a scoped logger for a specific component
   */
  forComponent(component: string): ClientLogger {
    return this.child({ component })
  }

  /**
   * Create a scoped logger for a specific page
   */
  forPage(page: string): ClientLogger {
    return this.child({ page })
  }

  /**
   * Send client logs to server (optional feature)
   */
  async sendToServer(
    level: LogLevel,
    message: string,
    error?: ErrorInfo,
    context?: LogContext
  ): Promise<void> {
    try {
      const payload = {
        level,
        message,
        error,
        context: mergeContexts(this.baseContext, context),
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }

      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      // Fallback to console if server logging fails
      console.error('Failed to send log to server:', err)
    }
  }
}

// Default client logger instance
let defaultLogger: ClientLogger | undefined

/**
 * Get the default client logger instance
 */
export function getClientLogger(config?: Partial<LoggerConfig>): ClientLogger {
  if (!defaultLogger || config) {
    defaultLogger = new ClientLogger(config)
  }
  return defaultLogger
}

/**
 * Create a new client logger instance
 */
export function createClientLogger(config?: Partial<LoggerConfig>, context?: LogContext): ClientLogger {
  return new ClientLogger(config, context)
}

// Re-export types
export type * from './types.js'