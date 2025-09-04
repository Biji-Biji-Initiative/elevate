import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateTraceId,
  generateRequestId,
  mergeContexts,
  serializeError,
  createTimer,
  endTimer,
  sanitizeLogData,
  extractRequestInfo,
  formatDuration,
  formatMemory,
  createLogMeta,
} from '../utils'
import type { LogContext } from '../types'

describe('Utils', () => {
  describe('ID generation', () => {
    it('should generate unique trace IDs', () => {
      const id1 = generateTraceId()
      const id2 = generateTraceId()
      
      expect(id1).toMatch(/^[a-f0-9]{32}$/)
      expect(id2).toMatch(/^[a-f0-9]{32}$/)
      expect(id1).not.toBe(id2)
    })

    it('should generate unique request IDs', () => {
      const id1 = generateRequestId()
      const id2 = generateRequestId()
      
      expect(id1).toMatch(/^[a-f0-9]{16}$/)
      expect(id2).toMatch(/^[a-f0-9]{16}$/)
      expect(id1).not.toBe(id2)
    })
  })

  describe('Context management', () => {
    it('should return empty object when both contexts are undefined', () => {
      const result = mergeContexts()
      expect(result).toEqual({})
    })

    it('should return child context when parent is undefined', () => {
      const child: LogContext = { userId: '123' }
      const result = mergeContexts(undefined, child)
      expect(result).toBe(child)
    })

    it('should return parent context when child is undefined', () => {
      const parent: LogContext = { userId: '123' }
      const result = mergeContexts(parent, undefined)
      expect(result).toBe(parent)
    })

    it('should merge contexts with child overriding parent', () => {
      const parent: LogContext = { 
        userId: '123', 
        action: 'old',
        meta: { a: 1, b: 2 }
      }
      const child: LogContext = { 
        action: 'new',
        requestId: 'req-456',
        meta: { b: 3, c: 4 }
      }
      
      const result = mergeContexts(parent, child)
      
      expect(result).toEqual({
        userId: '123',
        action: 'new',
        requestId: 'req-456',
        meta: { a: 1, b: 3, c: 4 }
      })
    })
  })

  describe('Error serialization', () => {
    it('should serialize Error objects', () => {
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at test.js:1:1'
      
      const context: LogContext = { userId: '123' }
      const result = serializeError(error, context)
      
      expect(result).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: 'Error: Test error\n    at test.js:1:1',
        code: undefined,
        cause: undefined,
        context,
      })
    })

    it('should serialize Error objects with code and cause', () => {
      const error = new Error('Test error') as unknown as Error & { code?: string; cause?: unknown }
      error.code = 'ENOENT'
      error.cause = 'File not found'
      
      const result = serializeError(error)
      
      expect(result).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: error.stack,
        code: 'ENOENT',
        cause: 'File not found',
        context: undefined,
      })
    })

    it('should serialize string errors', () => {
      const result = serializeError('String error')
      
      expect(result).toEqual({
        name: 'StringError',
        message: 'String error',
        context: undefined,
      })
    })

    it('should serialize object errors', () => {
      const errorObj = {
        name: 'CustomError',
        message: 'Custom error message',
        code: 500,
      }
      
      const result = serializeError(errorObj)
      
      expect(result).toEqual({
        name: 'CustomError',
        message: 'Custom error message',
        stack: undefined,
        code: 500,
        cause: undefined,
        context: undefined,
      })
    })

    it('should serialize unknown errors', () => {
      const result = serializeError(null)
      
      expect(result).toEqual({
        name: 'UnknownError',
        message: 'null',
        context: undefined,
      })
    })
  })

  describe('Timing utilities', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should create a timer with start time', () => {
      const startTime = Date.now()
      const timer = createTimer()
      
      expect(timer.startTime).toBe(startTime)
      expect(timer.endTime).toBeUndefined()
      expect(timer.duration).toBeUndefined()
    })

    it('should end timer and calculate duration', () => {
      const timer = createTimer()
      
      // Advance time by 100ms
      vi.advanceTimersByTime(100)
      
      const endedTimer = endTimer(timer)
      
      expect(endedTimer.startTime).toBe(timer.startTime)
      expect(endedTimer.endTime).toBe(timer.startTime + 100)
      expect(endedTimer.duration).toBe(100)
    })
  })

  describe('Data sanitization', () => {
    it('should sanitize default fields', () => {
      const data = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
        token: 'abc123',
      }
      
      const result = sanitizeLogData(data)
      
      expect(result).toEqual({
        username: 'john',
        password: '[REDACTED]',
        email: 'john@example.com',
        token: '[REDACTED]',
      })
    })

    it('should sanitize custom fields', () => {
      const data = {
        username: 'john',
        customSecret: 'secret',
        publicData: 'visible',
      }
      
      const result = sanitizeLogData(data, ['customSecret'])
      
      expect(result).toEqual({
        username: 'john',
        customSecret: '[REDACTED]',
        publicData: 'visible',
      })
    })

    it('should handle case-insensitive field matching', () => {
      const data = {
        PASSWORD: 'secret',
        Token: 'abc123',
        username: 'john',
      }
      
      const result = sanitizeLogData(data, ['password', 'token'])
      
      expect(result).toEqual({
        PASSWORD: '[REDACTED]',
        Token: '[REDACTED]',
        username: 'john',
      })
    })
  })

  describe('Request info extraction', () => {
    it('should extract request information', () => {
      const mockRequest = new Request('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'user-agent': 'Mozilla/5.0',
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
          'x-real-ip': '192.168.1.1',
        },
      })
      
      const result = extractRequestInfo(mockRequest)
      
      expect(result).toEqual({
        method: 'POST',
        url: 'https://example.com/api/test',
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
      })
    })

    it('should handle missing headers', () => {
      const mockRequest = new Request('https://example.com/api/test', {
        method: 'GET',
      })
      
      const result = extractRequestInfo(mockRequest)
      
      expect(result).toEqual({
        method: 'GET',
        url: 'https://example.com/api/test',
        userAgent: undefined,
        ip: undefined,
      })
    })
  })

  describe('Formatting utilities', () => {
    it('should format duration in milliseconds', () => {
      expect(formatDuration(100)).toBe('100ms')
      expect(formatDuration(500)).toBe('500ms')
      expect(formatDuration(999)).toBe('999ms')
    })

    it('should format duration in seconds', () => {
      expect(formatDuration(1000)).toBe('1.00s')
      expect(formatDuration(1500)).toBe('1.50s')
      expect(formatDuration(59999)).toBe('60.00s')
    })

    it('should format duration in minutes', () => {
      expect(formatDuration(60000)).toBe('1.00m')
      expect(formatDuration(90000)).toBe('1.50m')
    })

    it('should format memory in bytes', () => {
      expect(formatMemory(100)).toBe('100.00B')
      expect(formatMemory(512)).toBe('512.00B')
      expect(formatMemory(1023)).toBe('1023.00B')
    })

    it('should format memory in kilobytes', () => {
      expect(formatMemory(1024)).toBe('1.00KB')
      expect(formatMemory(1536)).toBe('1.50KB')
    })

    it('should format memory in megabytes', () => {
      expect(formatMemory(1024 * 1024)).toBe('1.00MB')
      expect(formatMemory(1024 * 1024 * 1.5)).toBe('1.50MB')
    })

    it('should format memory in gigabytes', () => {
      expect(formatMemory(1024 * 1024 * 1024)).toBe('1.00GB')
      expect(formatMemory(1024 * 1024 * 1024 * 2.5)).toBe('2.50GB')
    })
  })

  describe('Log metadata creation', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should create basic log metadata', () => {
      const result = createLogMeta('api')
      
      expect(result).toEqual({
        type: 'api',
        timestamp: '2024-01-01T12:00:00.000Z',
      })
    })

    it('should create log metadata with data and context', () => {
      const data = { statusCode: 200, duration: 150 }
      const context: LogContext = { userId: '123', action: 'test' }
      
      const result = createLogMeta('api', data, context)
      
      expect(result).toEqual({
        type: 'api',
        timestamp: '2024-01-01T12:00:00.000Z',
        statusCode: 200,
        duration: 150,
        context,
      })
    })
  })
})
