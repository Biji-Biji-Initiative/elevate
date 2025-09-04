import pino from 'pino'

import {
  createLoggerConfig,
  getDefaultPinoConfig,
} from './config'
import {
  mergeContexts,
  serializeError,
  createTimer,
  endTimer,
  createLogMeta,
} from './utils'

import type {
  LogContext,
  LoggerConfig,
  LogLevel,
  LogMethod,
  LogMethodWithError,
  ApiLogData,
  DatabaseLogData,
  AuthLogData,
  WebhookLogData,
  SecurityLogData,
  AuditLogData,
  PerformanceLogData,
} from './types'

export class Logger {
  private pino: pino.Logger
  private config: LoggerConfig
  private baseContext?: LogContext

  constructor(config?: Partial<LoggerConfig>, baseContext?: LogContext) {
    this.config = createLoggerConfig(config)
    if (baseContext) {
      this.baseContext = baseContext
    }
    const pinoConfig = getDefaultPinoConfig(this.config)
    this.pino = pino(pinoConfig as pino.LoggerOptions)
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger(this.config, mergeContexts(this.baseContext, context))
    childLogger.pino = this.pino.child(context)
    return childLogger
  }

  /**
   * Update the base context for this logger instance
   */
  setContext(context: LogContext): void {
    this.baseContext = mergeContexts(this.baseContext, context)
  }

  /**
   * Get the current context
   */
  getContext(): LogContext | undefined {
    return this.baseContext
  }

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.pino.isLevelEnabled(level)
  }

  // Standard logging methods
  fatal: LogMethodWithError = (msg, error?, context?) => {
    const ctx = mergeContexts(this.baseContext, context)
    if (error) {
      this.pino.fatal({ ...ctx, error: serializeError(error, ctx) }, msg)
    } else {
      this.pino.fatal(ctx, msg)
    }
  }

  error: LogMethodWithError = (msg, error?, context?) => {
    const ctx = mergeContexts(this.baseContext, context)
    if (error) {
      this.pino.error({ ...ctx, error: serializeError(error, ctx) }, msg)
    } else {
      this.pino.error(ctx, msg)
    }
  }

  warn: LogMethod = (msg, context?) => {
    const ctx = mergeContexts(this.baseContext, context)
    this.pino.warn(ctx, msg)
  }

  info: LogMethod = (msg, context?) => {
    const ctx = mergeContexts(this.baseContext, context)
    this.pino.info(ctx, msg)
  }

  debug: LogMethod = (msg, context?) => {
    const ctx = mergeContexts(this.baseContext, context)
    this.pino.debug(ctx, msg)
  }

  trace: LogMethod = (msg, context?) => {
    const ctx = mergeContexts(this.baseContext, context)
    this.pino.trace(ctx, msg)
  }

  // Specialized logging methods
  
  /**
   * Log API requests and responses
   */
  api(data: ApiLogData, context?: LogContext): void {
    const ctx = mergeContexts(this.baseContext, context)
    const meta = createLogMeta('api', data, ctx)
    
    const level = data.statusCode >= 500 ? 'error' : 
                  data.statusCode >= 400 ? 'warn' : 'info'
    
    this.pino[level](
      meta as Record<string, unknown>,
      `API ${data.method} ${data.route || data.url} ${data.statusCode} ${data.duration}ms`
    )
  }

  /**
   * Log database operations
   */
  database(data: DatabaseLogData, context?: LogContext): void {
    const ctx = mergeContexts(this.baseContext, context)
    const meta = createLogMeta('database', data, ctx)
    
    if (data.error) {
      this.pino.error(meta as Record<string, unknown>, `Database ${data.operation} failed: ${data.error}`)
    } else {
      const msg = `Database ${data.operation}${data.table ? ` on ${data.table}` : ''} (${data.duration}ms${data.rows ? `, ${data.rows} rows` : ''})`
      this.pino.info(meta as Record<string, unknown>, msg)
    }
  }

  /**
   * Log authentication events
   */
  auth(data: AuthLogData, context?: LogContext): void {
    const ctx = mergeContexts(this.baseContext, context)
    const meta = createLogMeta('auth', data, ctx)
    
    const level = data.success ? 'info' : 'warn'
    const result = data.success ? 'succeeded' : 'failed'
    const msg = `Authentication ${data.action} ${result}${data.userId ? ` for user ${data.userId}` : ''}${data.reason ? ` (${data.reason})` : ''}`
    
    this.pino[level](meta as Record<string, unknown>, msg)
  }

  /**
   * Log webhook events
   */
  webhook(data: WebhookLogData, context?: LogContext): void {
    const ctx = mergeContexts(this.baseContext, context)
    const meta = createLogMeta('webhook', data, ctx)
    
    const level = data.success ? 'info' : 'error'
    const result = data.success ? 'processed' : 'failed'
    const msg = `Webhook ${data.provider}:${data.eventType} ${result} (${data.duration}ms${data.retryCount ? `, retry ${data.retryCount}` : ''})`
    
    this.pino[level](meta as Record<string, unknown>, msg)
  }

  /**
   * Log security events
   */
  security(data: SecurityLogData, context?: LogContext): void {
    const ctx = mergeContexts(this.baseContext, context)
    const meta = createLogMeta('security', data, ctx)
    
    const level = data.severity === 'critical' ? 'fatal' :
                  data.severity === 'high' ? 'error' :
                  data.severity === 'medium' ? 'warn' : 'info'
    
    this.pino[level](meta, `Security event: ${data.event} (${data.severity} severity)`)
  }

  /**
   * Log audit trail events
   */
  audit(data: AuditLogData, context?: LogContext): void {
    const ctx = mergeContexts(this.baseContext, context)
    const meta = createLogMeta('audit', data, ctx)
    
    const level = data.success ? 'info' : 'warn'
    const result = data.success ? 'completed' : 'failed'
    const msg = `Audit: ${data.action} by ${data.actorId} ${result}${data.targetId ? ` on ${data.targetId}` : ''}`
    
    this.pino[level](meta as Record<string, unknown>, msg)
  }

  /**
   * Log performance metrics
   */
  performance(data: PerformanceLogData, context?: LogContext): void {
    const ctx = mergeContexts(this.baseContext, context)
    const meta = createLogMeta('performance', data, ctx)
    
    this.pino.info(meta, `Performance: ${data.operation} took ${data.duration}ms`)
  }

  /**
   * Create a timing context and return a function to complete it
   */
  createTimer() {
    const timer = createTimer()
    return {
      timer,
      end: () => endTimer(timer),
      complete: (operation: string, context?: LogContext) => {
        const completed = endTimer(timer)
        this.performance(
          {
            operation,
            duration: completed.duration,
          },
          context
        )
        return completed
      },
    }
  }

  /**
   * Create a scoped logger for a specific request
   */
  forRequest(requestId: string, userId?: string): Logger {
    const context: LogContext = { requestId }
    if (userId) {
      context.userId = userId
    }
    return this.child(context)
  }

  /**
   * Create a scoped logger for a specific module
   */
  forModule(module: string): Logger {
    return this.child({
      module,
    })
  }

  /**
   * Create a scoped logger for a specific component
   */
  forComponent(component: string): Logger {
    return this.child({
      component,
    })
  }

  /**
   * Flush all pending log entries (useful for testing)
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.pino.flush(() => resolve())
    })
  }

  /**
   * Get the underlying Pino logger (escape hatch)
   */
  getPino(): pino.Logger {
    return this.pino
  }
}
