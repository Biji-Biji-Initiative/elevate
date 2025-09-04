import type { LoggerConfig, LogLevel } from './types'

export const DEFAULT_REDACT_FIELDS = [
  'password',
  'secret',
  'token',
  'key',
  'authorization',
  'auth',
  'cookie',
  'session',
  'apiKey',
  'api_key',
  'client_secret',
  'access_token',
  'refresh_token',
  'jwt',
  'privateKey',
  'private_key',
  'credentials',
  'ssn',
  'social_security',
  'credit_card',
  'card_number',
  'cvv',
  'pin',
]

export function parseLogLevel(level: string | undefined): LogLevel {
  const validLevels: LogLevel[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace']
  
  if (!level) return 'info'
  
  const lowerLevel = level.toLowerCase() as LogLevel
  return validLevels.includes(lowerLevel) ? lowerLevel : 'info'
}

export function parseRedactFields(fields: string | undefined): string[] {
  if (!fields) return DEFAULT_REDACT_FIELDS
  
  try {
    const customFields = fields.split(',').map(field => field.trim()).filter(Boolean)
    return [...DEFAULT_REDACT_FIELDS, ...customFields]
  } catch {
    return DEFAULT_REDACT_FIELDS
  }
}

export function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

export function createLoggerConfig(options: Partial<LoggerConfig> = {}): LoggerConfig {
  const environment = process.env.NODE_ENV || 'development'
  
  return {
    level: options.level || parseLogLevel(process.env.LOG_LEVEL),
    pretty: options.pretty ?? (environment === 'development' || parseBoolean(process.env.LOG_PRETTY)),
    redact: options.redact || parseRedactFields(process.env.LOG_REDACT),
    name: options.name || process.env.LOG_NAME || 'elevate',
    environment,
  }
}

export function getDefaultPinoConfig(config: LoggerConfig) {
  const baseConfig = {
    name: config.name,
    level: config.level,
    formatters: {
      level: (label: string) => ({ level: label }),
      bindings: (bindings: Record<string, unknown>) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        environment: config.environment,
      }),
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    redact: {
      paths: config.redact,
      censor: '[REDACTED]',
    },
  }

  if (config.pretty) {
    return {
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false,
          levelFirst: true,
          messageFormat: '{msg}',
          errorLikeObjectKeys: ['err', 'error'],
          customPrettifiers: {
            // Custom formatting for our context fields
            context: (value: unknown) => {
              if (!value || typeof value !== 'object' || value === null) return ''
              const contextObj = value as Record<string, unknown>
              const parts = []
              if (typeof contextObj.userId === 'string') parts.push(`user:${contextObj.userId}`)
              if (typeof contextObj.requestId === 'string') parts.push(`req:${contextObj.requestId.slice(-8)}`)
              if (typeof contextObj.action === 'string') parts.push(`action:${contextObj.action}`)
              return parts.length > 0 ? `[${parts.join('|')}]` : ''
            },
          },
        },
      },
    }
  }

  return baseConfig
}
