import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  parseLogLevel,
  parseRedactFields,
  parseBoolean,
  createLoggerConfig,
  getDefaultPinoConfig,
  DEFAULT_REDACT_FIELDS,
} from '../config.js'
import type { LoggerConfig } from '../types.js'

describe('Config utilities', () => {
  beforeEach(() => {
    // Clear environment variables
    vi.unstubAllEnvs()
  })

  describe('parseLogLevel', () => {
    it('should return info as default level', () => {
      expect(parseLogLevel(undefined)).toBe('info')
      expect(parseLogLevel('')).toBe('info')
    })

    it('should parse valid log levels', () => {
      expect(parseLogLevel('fatal')).toBe('fatal')
      expect(parseLogLevel('error')).toBe('error')
      expect(parseLogLevel('warn')).toBe('warn')
      expect(parseLogLevel('info')).toBe('info')
      expect(parseLogLevel('debug')).toBe('debug')
      expect(parseLogLevel('trace')).toBe('trace')
    })

    it('should handle case insensitive input', () => {
      expect(parseLogLevel('ERROR')).toBe('error')
      expect(parseLogLevel('Debug')).toBe('debug')
      expect(parseLogLevel('WARN')).toBe('warn')
    })

    it('should fallback to info for invalid levels', () => {
      expect(parseLogLevel('invalid')).toBe('info')
      expect(parseLogLevel('verbose')).toBe('info')
      expect(parseLogLevel('123')).toBe('info')
    })
  })

  describe('parseRedactFields', () => {
    it('should return default fields when input is undefined', () => {
      expect(parseRedactFields(undefined)).toEqual(DEFAULT_REDACT_FIELDS)
    })

    it('should parse comma-separated fields', () => {
      const input = 'field1,field2,field3'
      const expected = [...DEFAULT_REDACT_FIELDS, 'field1', 'field2', 'field3']
      expect(parseRedactFields(input)).toEqual(expected)
    })

    it('should handle whitespace in fields', () => {
      const input = ' field1 , field2 , field3 '
      const expected = [...DEFAULT_REDACT_FIELDS, 'field1', 'field2', 'field3']
      expect(parseRedactFields(input)).toEqual(expected)
    })

    it('should filter out empty fields', () => {
      const input = 'field1,,field2,,'
      const expected = [...DEFAULT_REDACT_FIELDS, 'field1', 'field2']
      expect(parseRedactFields(input)).toEqual(expected)
    })

    it('should handle invalid input gracefully', () => {
      // Mock console to suppress error logging in test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      expect(parseRedactFields('')).toEqual(DEFAULT_REDACT_FIELDS)
      
      consoleSpy.mockRestore()
    })
  })

  describe('parseBoolean', () => {
    it('should parse true values', () => {
      expect(parseBoolean('true')).toBe(true)
      expect(parseBoolean('1')).toBe(true)
    })

    it('should parse false values', () => {
      expect(parseBoolean('false')).toBe(false)
      expect(parseBoolean('0')).toBe(false)
      expect(parseBoolean('')).toBe(false)
      expect(parseBoolean(undefined)).toBe(false)
      expect(parseBoolean('anything')).toBe(false)
    })
  })

  describe('createLoggerConfig', () => {
    it('should create default config in development', () => {
      vi.stubEnv('NODE_ENV', 'development')
      
      const config = createLoggerConfig()
      
      expect(config).toEqual({
        level: 'info',
        pretty: true, // Default to true in development
        redact: DEFAULT_REDACT_FIELDS,
        name: 'elevate',
        environment: 'development',
      })
    })

    it('should create config from environment variables', () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('LOG_LEVEL', 'debug')
      vi.stubEnv('LOG_PRETTY', 'true')
      vi.stubEnv('LOG_REDACT', 'custom1,custom2')
      vi.stubEnv('LOG_NAME', 'test-app')
      
      const config = createLoggerConfig()
      
      expect(config).toEqual({
        level: 'debug',
        pretty: true,
        redact: [...DEFAULT_REDACT_FIELDS, 'custom1', 'custom2'],
        name: 'test-app',
        environment: 'production',
      })
    })

    it('should override with provided options', () => {
      vi.stubEnv('LOG_LEVEL', 'info')
      
      const options: Partial<LoggerConfig> = {
        level: 'error',
        name: 'override-logger',
      }
      
      const config = createLoggerConfig(options)
      
      expect(config.level).toBe('error')
      expect(config.name).toBe('override-logger')
    })
  })

  describe('getDefaultPinoConfig', () => {
    it('should create basic pino config', () => {
      const loggerConfig: LoggerConfig = {
        level: 'info',
        pretty: false,
        redact: ['password'],
        name: 'test',
        environment: 'production',
      }
      
      const pinoConfig = getDefaultPinoConfig(loggerConfig)
      
      expect(pinoConfig).toMatchObject({
        name: 'test',
        level: 'info',
        formatters: expect.any(Object),
        timestamp: expect.any(Function),
        redact: {
          paths: ['password'],
          censor: '[REDACTED]',
        },
      })
    })

    it('should include pretty transport config when pretty is true', () => {
      const loggerConfig: LoggerConfig = {
        level: 'debug',
        pretty: true,
        redact: ['secret'],
        name: 'test-pretty',
        environment: 'development',
      }
      
      const pinoConfig = getDefaultPinoConfig(loggerConfig)
      
      expect(pinoConfig.transport).toEqual({
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
            context: expect.any(Function),
          },
        },
      })
    })

    it('should format timestamp correctly', () => {
      const loggerConfig: LoggerConfig = {
        level: 'info',
        pretty: false,
        redact: [],
        name: 'test',
      }
      
      const pinoConfig = getDefaultPinoConfig(loggerConfig)
      const timestamp = pinoConfig.timestamp()
      
      // Should return a timestamp in ISO format with proper JSON comma prefix
      expect(timestamp).toMatch(/^,"time":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"$/)
    })

    it('should format bindings correctly', () => {
      const loggerConfig: LoggerConfig = {
        level: 'info',
        pretty: false,
        redact: [],
        name: 'test',
        environment: 'test',
      }
      
      const pinoConfig = getDefaultPinoConfig(loggerConfig)
      const bindings = pinoConfig.formatters.bindings({ 
        pid: 12345, 
        hostname: 'test-host',
        extra: 'ignored'
      })
      
      expect(bindings).toEqual({
        pid: 12345,
        hostname: 'test-host',
        environment: 'test',
      })
    })

    it('should format level correctly', () => {
      const loggerConfig: LoggerConfig = {
        level: 'info',
        pretty: false,
        redact: [],
        name: 'test',
      }
      
      const pinoConfig = getDefaultPinoConfig(loggerConfig)
      const level = pinoConfig.formatters.level('error')
      
      expect(level).toEqual({ level: 'error' })
    })
  })

  describe('Pretty formatter context function', () => {
    it('should format context with all fields', () => {
      const loggerConfig: LoggerConfig = {
        level: 'info',
        pretty: true,
        redact: [],
        name: 'test',
      }
      
      const pinoConfig = getDefaultPinoConfig(loggerConfig)
      const contextFormatter = pinoConfig.transport?.options?.customPrettifiers?.context
      
      if (contextFormatter) {
        const context = {
          userId: 'user123',
          requestId: 'req-abcdef123456',
          action: 'login',
        }
        
        const result = contextFormatter(context)
        
        expect(result).toBe('[user:user123|req:123456|action:login]')
      }
    })

    it('should format context with partial fields', () => {
      const loggerConfig: LoggerConfig = {
        level: 'info',
        pretty: true,
        redact: [],
        name: 'test',
      }
      
      const pinoConfig = getDefaultPinoConfig(loggerConfig)
      const contextFormatter = pinoConfig.transport?.options?.customPrettifiers?.context
      
      if (contextFormatter) {
        const context = {
          action: 'logout',
        }
        
        const result = contextFormatter(context)
        
        expect(result).toBe('[action:logout]')
      }
    })

    it('should return empty string for empty context', () => {
      const loggerConfig: LoggerConfig = {
        level: 'info',
        pretty: true,
        redact: [],
        name: 'test',
      }
      
      const pinoConfig = getDefaultPinoConfig(loggerConfig)
      const contextFormatter = pinoConfig.transport?.options?.customPrettifiers?.context
      
      if (contextFormatter) {
        const result1 = contextFormatter(null)
        const result2 = contextFormatter({})
        
        expect(result1).toBe('')
        expect(result2).toBe('')
      }
    })
  })
})