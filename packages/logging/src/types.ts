export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

export interface LogContext {
  userId?: string
  requestId?: string
  traceId?: string
  sessionId?: string
  action?: string
  targetId?: string
  module?: string
  component?: string
  meta?: Record<string, unknown>
  // Allow additional properties
  [key: string]: unknown
}

export interface LoggerConfig {
  level: LogLevel
  pretty: boolean
  redact: string[]
  name?: string
  environment?: string
}

export interface TimingData {
  startTime: number
  endTime?: number
  duration?: number
}

export interface CompletedTimingData {
  startTime: number
  endTime: number
  duration: number
}

export interface ApiLogData {
  method: string
  url: string
  route?: string
  statusCode: number
  duration: number
  userAgent?: string
  ip?: string
  size?: number
  error?: string
}

export interface DatabaseLogData {
  operation: string
  table?: string
  query?: string
  params?: unknown[]
  duration: number
  rows?: number
  error?: string
}

export interface AuthLogData {
  action: 'login' | 'logout' | 'signup' | 'password_reset' | 'email_verify' | 'role_check' | 'permission_check'
  userId?: string
  email?: string
  success: boolean
  provider?: string
  role?: string
  permissions?: string[]
  reason?: string
  error?: string
}

export interface WebhookLogData {
  provider: string
  eventType: string
  eventId?: string
  success: boolean
  duration: number
  retryCount?: number
  error?: string
  payload?: unknown
}

export interface SecurityLogData {
  event: 'csrf_violation' | 'csp_violation' | 'rate_limit_hit' | 'auth_failure' | 'suspicious_activity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  ip?: string
  userAgent?: string
  userId?: string
  details?: Record<string, unknown>
}

export interface AuditLogData {
  action: string
  actorId: string
  actorType?: 'user' | 'system' | 'webhook' | 'admin'
  targetId?: string
  targetType?: string
  changes?: Record<string, { old?: unknown; new?: unknown }>
  metadata?: Record<string, unknown>
  success: boolean
}

export interface PerformanceLogData {
  operation: string
  duration: number
  memory?: {
    used: number
    free: number
    total: number
  }
  cpu?: {
    user: number
    system: number
  }
  custom?: Record<string, number>
}

export interface ErrorInfo {
  name: string
  message: string
  stack?: string
  code?: string | number
  cause?: unknown
  context?: LogContext
}

export interface LogEntry {
  level: LogLevel
  time: Date
  msg: string
  context?: LogContext
  error?: ErrorInfo
  [key: string]: unknown
}

export type LogMethod = (msg: string, context?: LogContext) => void
export type LogMethodWithError = (msg: string, error?: Error | unknown, context?: LogContext) => void