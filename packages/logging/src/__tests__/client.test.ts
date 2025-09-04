/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ClientLogger, getClientLogger, createClientLogger } from '../client.js'
import type { LoggerConfig, LogContext } from '../types.js'

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
}

// Mock fetch for server logging
global.fetch = vi.fn()

// Mock navigator and window
Object.defineProperty(window, 'location', {
  value: { href: 'https://example.com/test' },
  writable: true,
})

Object.defineProperty(global, 'navigator', {
  value: { userAgent: 'test-agent' },
  writable: true,
})

describe('ClientLogger', () => {
  let logger: ClientLogger

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Replace console methods
    Object.assign(console, mockConsole)
    
    const config: LoggerConfig = {
      level: 'debug',
      pretty: true,
      redact: ['password'],
      name: 'test-client-logger',
    }

    // Set NODE_ENV to development to enable logging
    vi.stubEnv('NODE_ENV', 'development')
    
    logger = new ClientLogger(config)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  describe('Constructor', () => {
    it('should create a logger with default config', () => {
      const defaultLogger = new ClientLogger()
      
      expect(defaultLogger).toBeInstanceOf(ClientLogger)
    })

    it('should create a logger with base context', () => {
      const baseContext = { userId: '123', component: 'TestComponent' }
      const loggerWithContext = new ClientLogger(undefined, baseContext)
      
      expect(loggerWithContext).toBeInstanceOf(ClientLogger)
    })

    it('should disable logging in production', () => {
      vi.stubEnv('NODE_ENV', 'production')
      
      const prodLogger = new ClientLogger({ level: 'info' })
      
      prodLogger.info('Test message')
      
      // Should not log in production
      expect(mockConsole.log).not.toHaveBeenCalled()
    })
  })

  describe('Child logger', () => {
    it('should create a child logger with merged context', () => {
      const baseContext = { userId: '123' }
      const childContext = { component: 'TestComponent' }
      
      logger.setContext(baseContext)
      const childLogger = logger.child(childContext)
      
      expect(childLogger).toBeInstanceOf(ClientLogger)
    })
  })

  describe('Logging levels', () => {
    it('should log fatal messages', () => {
      const message = 'Fatal error occurred'
      const error = new Error('Fatal error')
      const context: LogContext = { action: 'test' }
      
      logger.fatal(message, error, context)
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('test-client-logger FATAL: Fatal error occurred'),
        expect.objectContaining({
          level: 'fatal',
          message,
          error: expect.objectContaining({
            name: 'Error',
            message: 'Fatal error',
          }),
          context,
        })
      )
    })

    it('should log error messages', () => {
      const message = 'Error occurred'
      const error = new Error('Test error')
      
      logger.error(message, error)
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: Error occurred'),
        expect.objectContaining({
          level: 'error',
          message,
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error',
          }),
        })
      )
    })

    it('should log warn messages', () => {
      const message = 'Warning message'
      const context: LogContext = { userId: '123' }
      
      logger.warn(message, context)
      
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN: Warning message'),
        expect.objectContaining({
          level: 'warn',
          message,
          context,
        })
      )
    })

    it('should log info messages', () => {
      const message = 'Info message'
      
      logger.info(message)
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Info message'),
        expect.objectContaining({
          level: 'info',
          message,
        })
      )
    })

    it('should log debug messages', () => {
      const message = 'Debug message'
      
      logger.debug(message)
      
      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG: Debug message'),
        expect.objectContaining({
          level: 'debug',
          message,
        })
      )
    })

    it('should log trace messages', () => {
      const message = 'Trace message'
      
      logger.trace(message)
      
      expect(mockConsole.trace).toHaveBeenCalledWith(
        expect.stringContaining('TRACE: Trace message'),
        expect.objectContaining({
          level: 'trace',
          message,
        })
      )
    })
  })

  describe('Log level filtering', () => {
    it('should respect log levels', () => {
      const warnLogger = new ClientLogger({ level: 'warn' })
      
      warnLogger.debug('Debug message')
      warnLogger.info('Info message')
      warnLogger.warn('Warn message')
      warnLogger.error('Error message')
      
      expect(mockConsole.debug).not.toHaveBeenCalled()
      expect(mockConsole.log).not.toHaveBeenCalled()
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN: Warn message'),
        expect.any(Object)
      )
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: Error message'),
        expect.any(Object)
      )
    })
  })

  describe('Special logging methods', () => {
    it('should log user actions', () => {
      const action = 'button_click'
      const details = { buttonId: 'submit', page: 'login' }
      const context: LogContext = { userId: '123' }
      
      logger.userAction(action, details, context)
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('User action: button_click'),
        expect.objectContaining({
          level: 'info',
          message: 'User action: button_click',
          context: expect.objectContaining({
            ...context,
            action: 'user_interaction',
            details,
          }),
        })
      )
    })

    it('should log navigation events', () => {
      const from = '/dashboard'
      const to = '/profile'
      
      logger.navigation(from, to)
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Navigation: /dashboard → /profile'),
        expect.objectContaining({
          level: 'info',
          message: 'Navigation: /dashboard → /profile',
          context: expect.objectContaining({
            action: 'navigation',
            from,
            to,
          }),
        })
      )
    })

    it('should log API calls with success status', () => {
      const method = 'GET'
      const url = '/api/users'
      const status = 200
      const duration = 150
      
      logger.apiCall(method, url, status, duration)
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('API GET /api/users 200 (150ms)'),
        expect.objectContaining({
          level: 'info',
          context: expect.objectContaining({
            action: 'api_call',
            method,
            url,
            status,
            duration,
          }),
        })
      )
    })

    it('should log API calls with error status', () => {
      const method = 'POST'
      const url = '/api/users'
      const status = 500
      
      logger.apiCall(method, url, status)
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('API POST /api/users 500'),
        expect.objectContaining({
          level: 'error',
        })
      )
    })

    it('should log React errors', () => {
      const error = new Error('Component error')
      const errorInfo = { componentStack: 'ComponentA -> ComponentB' }
      const context: LogContext = { component: 'TestComponent' }
      
      logger.reactError(error, errorInfo, context)
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('React error'),
        expect.objectContaining({
          level: 'error',
          error: expect.objectContaining({
            name: 'Error',
            message: 'Component error',
          }),
          context: expect.objectContaining({
            ...context,
            action: 'react_error',
            componentStack: 'ComponentA -> ComponentB',
          }),
        })
      )
    })
  })

  describe('Context management', () => {
    it('should merge base context with log context', () => {
      const baseContext = { userId: '123', sessionId: 'sess-456' }
      const logContext = { action: 'test', component: 'TestComp' }
      
      logger.setContext(baseContext)
      logger.info('Test message', logContext)
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          context: expect.objectContaining({
            ...baseContext,
            ...logContext,
          }),
        })
      )
    })
  })

  describe('Scoped loggers', () => {
    it('should create component-scoped logger', () => {
      const componentLogger = logger.forComponent('LoginForm')
      
      expect(componentLogger).toBeInstanceOf(ClientLogger)
      
      componentLogger.info('Component message')
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          context: expect.objectContaining({
            component: 'LoginForm',
          }),
        })
      )
    })

    it('should create page-scoped logger', () => {
      const pageLogger = logger.forPage('dashboard')
      
      expect(pageLogger).toBeInstanceOf(ClientLogger)
      
      pageLogger.info('Page message')
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          context: expect.objectContaining({
            page: 'dashboard',
          }),
        })
      )
    })
  })

  describe('Server logging', () => {
    it('should send logs to server successfully', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }))
      
      const error = { name: 'Error', message: 'Test error', stack: 'stack trace' }
      const context: LogContext = { action: 'test' }
      
      await logger.sendToServer('error', 'Test message', error, context)
      
      expect(mockFetch).toHaveBeenCalledWith('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'error',
          message: 'Test message',
          error,
          context,
          timestamp: expect.any(String),
          userAgent: 'test-agent',
          url: 'https://example.com/test',
        }),
      })
    })

    it('should handle server logging failure gracefully', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      // Should not throw
      await expect(
        logger.sendToServer('error', 'Test message')
      ).resolves.toBeUndefined()
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Failed to send log to server:',
        expect.any(Error)
      )
    })
  })

  describe('Factory functions', () => {
    it('should get default client logger', () => {
      const defaultLogger = getClientLogger()
      
      expect(defaultLogger).toBeInstanceOf(ClientLogger)
    })

    it('should create new client logger', () => {
      const config: LoggerConfig = { level: 'warn', name: 'custom' }
      const context: LogContext = { component: 'TestComponent' }
      
      const customLogger = createClientLogger(config, context)
      
      expect(customLogger).toBeInstanceOf(ClientLogger)
    })
  })
})