import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Logger } from '../logger'
import type { LoggerConfig, LogContext } from '../types'

// Mock pino
vi.mock('pino', () => {
  const mockLogger = {
    fatal: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
    flush: vi.fn((cb) => cb && cb()),
    isLevelEnabled: vi.fn(),
  }

  const mockPino = vi.fn(() => mockLogger)
  mockPino.destination = vi.fn()

  return {
    default: mockPino,
    pino: mockPino,
    mockLogger,
  }
})

describe('Logger', () => {
  let logger: Logger
  let mockPinoLogger: any
  let mockPino: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Import mocked pino
    const pino = await import('pino')
    mockPino = pino.default
    
    const config: LoggerConfig = {
      level: 'info',
      pretty: false,
      redact: ['password', 'secret'],
      name: 'test-logger',
    }

    logger = new Logger(config)
    mockPinoLogger = mockPino.mock.results[0].value
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('should create a logger with default config', () => {
      expect(mockPino).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-logger',
          level: 'info',
        })
      )
    })

    it('should create a logger with base context', () => {
      const baseContext = { userId: '123', module: 'test' }
      const loggerWithContext = new Logger(undefined, baseContext)
      
      expect(loggerWithContext.getContext()).toEqual(baseContext)
    })
  })

  describe('Child logger', () => {
    it('should create a child logger with merged context', () => {
      const baseContext = { userId: '123' }
      const childContext = { action: 'test' }
      
      logger.setContext(baseContext)
      mockPinoLogger.child.mockReturnValue(mockPinoLogger)
      
      const childLogger = logger.child(childContext)
      
      expect(mockPinoLogger.child).toHaveBeenCalledWith(childContext)
      expect(childLogger).toBeInstanceOf(Logger)
    })
  })

  describe('Standard logging methods', () => {
    const testCases = [
      { method: 'fatal', level: 'fatal' },
      { method: 'error', level: 'error' },
      { method: 'warn', level: 'warn' },
      { method: 'info', level: 'info' },
      { method: 'debug', level: 'debug' },
      { method: 'trace', level: 'trace' },
    ]

    testCases.forEach(({ method, level }) => {
      it(`should log ${level} messages`, () => {
        const message = `Test ${level} message`
        const context: LogContext = { userId: '123', action: 'test' }
        
        ;(logger as unknown as Record<string, (msg: string, ctx: LogContext) => void>)[method](message, context)
        
        expect(mockPinoLogger[level]).toHaveBeenCalledWith(context, message)
      })

      if (method === 'fatal' || method === 'error') {
        it(`should log ${level} messages with error objects`, () => {
          const message = `Test ${level} message`
          const error = new Error('Test error')
          const context: LogContext = { userId: '123', action: 'test' }
          
          ;(logger as unknown as Record<string, (msg: string, err: Error, ctx: LogContext) => void>)[method](message, error, context)
          
          expect(mockPinoLogger[level]).toHaveBeenCalledWith(
            expect.objectContaining({
              ...context,
              error: expect.objectContaining({
                name: 'Error',
                message: 'Test error',
                stack: expect.any(String),
              }),
            }),
            message
          )
        })
      }
    })
  })

  describe('Specialized logging methods', () => {
    it('should log API requests', () => {
      const apiData = {
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        duration: 150,
        userAgent: 'test-agent',
      }
      
      logger.api(apiData)
      
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'api',
          timestamp: expect.any(String),
          ...apiData,
        }),
        'API GET /api/test 200 150ms'
      )
    })

    it('should log API errors with error level', () => {
      const apiData = {
        method: 'POST',
        url: '/api/test',
        statusCode: 500,
        duration: 150,
      }
      
      logger.api(apiData)
      
      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'api',
          ...apiData,
        }),
        'API POST /api/test 500 150ms'
      )
    })

    it('should log database operations', () => {
      const dbData = {
        operation: 'query',
        table: 'users',
        duration: 50,
        rows: 10,
      }
      
      logger.database(dbData)
      
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'database',
          ...dbData,
        }),
        'Database query on users (50ms, 10 rows)'
      )
    })

    it('should log database errors', () => {
      const dbData = {
        operation: 'insert',
        table: 'users',
        duration: 100,
        error: 'Duplicate key violation',
      }
      
      logger.database(dbData)
      
      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'database',
          ...dbData,
        }),
        'Database insert failed: Duplicate key violation'
      )
    })

    it('should log authentication events', () => {
      const authData = {
        action: 'login' as const,
        userId: '123',
        success: true,
        provider: 'google',
      }
      
      logger.auth(authData)
      
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auth',
          ...authData,
        }),
        'Authentication login succeeded for user 123'
      )
    })

    it('should log webhook events', () => {
      const webhookData = {
        provider: 'github',
        eventType: 'push',
        success: true,
        duration: 200,
        eventId: 'event-123',
      }
      
      logger.webhook(webhookData)
      
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'webhook',
          ...webhookData,
        }),
        'Webhook github:push processed (200ms)'
      )
    })

    it('should log security events with appropriate level', () => {
      const securityData = {
        event: 'csrf_violation' as const,
        severity: 'high' as const,
        ip: '192.168.1.1',
        details: { violation: 'invalid token' },
      }
      
      logger.security(securityData)
      
      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'security',
          ...securityData,
        }),
        'Security event: csrf_violation (high severity)'
      )
    })

    it('should log audit events', () => {
      const auditData = {
        action: 'user_created',
        actorId: 'admin-123',
        targetId: 'user-456',
        success: true,
        changes: { name: { old: undefined, new: 'John Doe' } },
      }
      
      logger.audit(auditData)
      
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'audit',
          ...auditData,
        }),
        'Audit: user_created by admin-123 completed on user-456'
      )
    })

    it('should log performance metrics', () => {
      const perfData = {
        operation: 'data_processing',
        duration: 1500,
        memory: { used: 1024, free: 512, total: 1536 },
      }
      
      logger.performance(perfData)
      
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'performance',
          ...perfData,
        }),
        'Performance: data_processing took 1500ms'
      )
    })
  })

  describe('Timer functionality', () => {
    it('should create and complete timers', () => {
      vi.useFakeTimers()
      
      const timerResult = logger.createTimer()
      
      // Advance time by 100ms
      vi.advanceTimersByTime(100)
      
      const completed = timerResult.complete('test_operation')
      
      expect(completed.duration).toBe(100)
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'performance',
          operation: 'test_operation',
          duration: 100,
        }),
        'Performance: test_operation took 100ms'
      )
      
      vi.useRealTimers()
    })
  })

  describe('Scoped loggers', () => {
    it('should create request-scoped logger', () => {
      mockPinoLogger.child.mockReturnValue(mockPinoLogger)
      
      const requestLogger = logger.forRequest('req-123', 'user-456')
      
      expect(mockPinoLogger.child).toHaveBeenCalledWith({
        requestId: 'req-123',
        userId: 'user-456',
      })
    })

    it('should create module-scoped logger', () => {
      mockPinoLogger.child.mockReturnValue(mockPinoLogger)
      
      const moduleLogger = logger.forModule('auth')
      
      expect(mockPinoLogger.child).toHaveBeenCalledWith({
        module: 'auth',
      })
    })

    it('should create component-scoped logger', () => {
      mockPinoLogger.child.mockReturnValue(mockPinoLogger)
      
      const componentLogger = logger.forComponent('LoginForm')
      
      expect(mockPinoLogger.child).toHaveBeenCalledWith({
        component: 'LoginForm',
      })
    })
  })

  describe('Context management', () => {
    it('should set and get context', () => {
      const context = { userId: '123', module: 'test' }
      
      logger.setContext(context)
      
      expect(logger.getContext()).toEqual(context)
    })

    it('should merge contexts when logging', () => {
      const baseContext = { userId: '123' }
      const logContext = { action: 'test' }
      
      logger.setContext(baseContext)
      logger.info('Test message', logContext)
      
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        { ...baseContext, ...logContext },
        'Test message'
      )
    })
  })

  describe('Utility methods', () => {
    it('should check if level is enabled', () => {
      mockPinoLogger.isLevelEnabled.mockReturnValue(true)
      
      const result = logger.isLevelEnabled('debug')
      
      expect(mockPinoLogger.isLevelEnabled).toHaveBeenCalledWith('debug')
      expect(result).toBe(true)
    })

    it('should flush logs', async () => {
      await logger.flush()
      
      expect(mockPinoLogger.flush).toHaveBeenCalled()
    })

    it('should return underlying Pino logger', () => {
      const pinoLogger = logger.getPino()
      
      expect(pinoLogger).toBe(mockPinoLogger)
    })
  })
})
