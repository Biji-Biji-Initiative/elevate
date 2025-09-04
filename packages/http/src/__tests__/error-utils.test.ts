import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'
import {
  redactSensitiveData,
  redactObjectSensitiveData,
  prepareErrorForLogging,
  createErrorResponse,
  createSuccessResponse,
  generateTraceId,
  logError,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  validationError,
  rateLimitExceeded
} from '../error-utils'
import { 
  ElevateApiError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError,
  ErrorSeverity 
} from '@elevate/types'
import { z } from 'zod'

describe('Sensitive Data Redaction Tests', () => {
  describe('redactSensitiveData', () => {
    describe('API Keys and Tokens', () => {
      it('should redact API keys with various formats', () => {
        const tests = [
          'API_KEY=sk_test_1234567890abcdef',
          'Api-Key: "sk_live_abcdefghijklmnop"',
          'api_key: sk_1234567890123456789012',
          'Authorization: Bearer sk_test_xyz123'
        ]

        tests.forEach(test => {
          const redacted = redactSensitiveData(test)
          expect(redacted).toBe('[REDACTED]')
        })
      })

      it('should redact OpenAI-style API keys', () => {
        const apiKey = 'sk_1234567890123456789012345678901234567890'
        const text = `Using API key: ${apiKey}`
        const redacted = redactSensitiveData(text)
        expect(redacted).not.toContain(apiKey)
        expect(redacted).toContain('[REDACTED]')
      })

      it('should redact JWT tokens', () => {
        const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
        const text = `Token: ${jwt}`
        const redacted = redactSensitiveData(text)
        expect(redacted).not.toContain(jwt)
        expect(redacted).toContain('[REDACTED]')
      })

      it('should redact GitHub tokens', () => {
        const token = 'ghp_1234567890123456789012345678901234567890'
        const text = `GitHub token: ${token}`
        const redacted = redactSensitiveData(text)
        expect(redacted).not.toContain(token)
        expect(redacted).toContain('[REDACTED]')
      })

      it('should redact AWS access keys', () => {
        const awsKey = 'AKIAIOSFODNN7EXAMPLE'
        const text = `AWS_ACCESS_KEY_ID=${awsKey}`
        const redacted = redactSensitiveData(text)
        expect(redacted).not.toContain(awsKey)
        expect(redacted).toContain('[REDACTED]')
      })
    })

    describe('Database Credentials', () => {
      it('should redact PostgreSQL connection strings', () => {
        const connectionString = 'postgresql://user:password@localhost:5432/dbname'
        const redacted = redactSensitiveData(connectionString)
        expect(redacted).not.toContain('password')
        expect(redacted).toContain('[REDACTED]')
      })

      it('should redact MySQL connection strings', () => {
        const connectionString = 'mysql://admin:secret123@db.example.com:3306/production'
        const redacted = redactSensitiveData(connectionString)
        expect(redacted).not.toContain('secret123')
        expect(redacted).toContain('[REDACTED]')
      })

      it('should redact Redis URLs', () => {
        const redisUrl = 'redis://user:pass123@redis.example.com:6379'
        const redacted = redactSensitiveData(redisUrl)
        expect(redacted).not.toContain('pass123')
        expect(redacted).toContain('[REDACTED]')
      })
    })

    describe('File Paths and System Information', () => {
      it('should redact Unix file paths', () => {
        const paths = [
          '/Users/john/secret/config.json',
          '/home/admin/.ssh/id_rsa',
          '/opt/app/secrets/database.env',
          '/var/log/sensitive.log',
          '/etc/passwords/master.txt',
          '/tmp/upload_xyz123.tmp'
        ]

        paths.forEach(path => {
          const redacted = redactSensitiveData(`File located at: ${path}`)
          expect(redacted).not.toContain(path)
          expect(redacted).toContain('[REDACTED]')
        })
      })

      it('should redact Windows file paths', () => {
        const paths = [
          'C:\\Users\\Administrator\\Documents\\secrets.txt',
          'C:\\Program Files\\App\\config.ini',
          'C:\\Windows\\System32\\drivers\\etc\\hosts',
          'C:\\temp\\sensitive_data.json'
        ]

        paths.forEach(path => {
          const redacted = redactSensitiveData(`Config at: ${path}`)
          expect(redacted).not.toContain(path)
          expect(redacted).toContain('[REDACTED]')
        })
      })

      it('should redact IP addresses', () => {
        const ipAddresses = [
          '192.168.1.100',
          '10.0.0.1',
          '172.16.254.1',
          '8.8.8.8',
          '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
        ]

        ipAddresses.forEach(ip => {
          const redacted = redactSensitiveData(`Server IP: ${ip}`)
          expect(redacted).not.toContain(ip)
          expect(redacted).toContain('[REDACTED]')
        })
      })

      it('should redact email addresses', () => {
        const emails = [
          'admin@company.com',
          'user.name+tag@example.org',
          'test123@subdomain.example.co.uk'
        ]

        emails.forEach(email => {
          const redacted = redactSensitiveData(`Contact: ${email}`)
          expect(redacted).not.toContain(email)
          expect(redacted).toContain('[REDACTED]')
        })
      })
    })

    describe('PII and Sensitive Patterns', () => {
      it('should redact credit card numbers', () => {
        const ccNumbers = [
          '4532-1234-5678-9012',
          '4532 1234 5678 9012',
          '4532123456789012'
        ]

        ccNumbers.forEach(cc => {
          const redacted = redactSensitiveData(`Card: ${cc}`)
          expect(redacted).not.toContain(cc)
          expect(redacted).toContain('[REDACTED]')
        })
      })

      it('should redact phone numbers', () => {
        const phoneNumbers = [
          '+1234567890123',
          '+44123456789',
          '+81234567890'
        ]

        phoneNumbers.forEach(phone => {
          const redacted = redactSensitiveData(`Phone: ${phone}`)
          expect(redacted).not.toContain(phone)
          expect(redacted).toContain('[REDACTED]')
        })
      })

      it('should redact environment variables with sensitive names', () => {
        const envVars = [
          'DATABASE_PASSWORD=super_secret_123',
          'SECRET_KEY="my-secret-key-here"',
          'PRIVATE_KEY=-----BEGIN PRIVATE KEY-----',
          'AUTH_TOKEN=abc123xyz789',
          'WEBHOOK_SECRET=webhook_secret_here'
        ]

        envVars.forEach(envVar => {
          const redacted = redactSensitiveData(envVar)
          expect(redacted).toContain('[REDACTED]')
          expect(redacted).not.toContain('super_secret_123')
          expect(redacted).not.toContain('my-secret-key-here')
        })
      })
    })

    describe('Length Preservation Option', () => {
      it('should preserve length when preserveLength=true', () => {
        const secret = 'API_KEY=1234567890'
        const redacted = redactSensitiveData(secret, true)
        expect(redacted.length).toBeLessThanOrEqual(20) // Max length capped at 20
        expect(redacted).toMatch(/^\*+$/)
      })

      it('should not preserve length when preserveLength=false', () => {
        const secret = 'API_KEY=very_long_secret_key_here_1234567890'
        const redacted = redactSensitiveData(secret, false)
        expect(redacted).toBe('[REDACTED]')
      })

      it('should handle empty and invalid inputs', () => {
        expect(redactSensitiveData('')).toBe('')
        expect(redactSensitiveData(null as unknown as string)).toBe(null)
        expect(redactSensitiveData(undefined as unknown as string)).toBe(undefined)
        expect(redactSensitiveData(123 as unknown as string)).toBe(123)
      })
    })
  })

  describe('redactObjectSensitiveData', () => {
    it('should redact sensitive data in nested objects', () => {
      const obj = {
        user: 'john',
        password: 'secret123',
        config: {
          database_password: 'db_secret',
          api_key: 'sk_test_123',
          safe_value: 'this is fine'
        },
        metadata: {
          ip_address: '192.168.1.1',
          file_path: '/Users/john/config.json'
        }
      }

      const redacted = redactObjectSensitiveData(obj)

      expect(redacted.user).toBe('john')
      expect(redacted.password).toBe('[REDACTED]')
      expect(redacted.config.database_password).toBe('[REDACTED]')
      expect(redacted.config.api_key).toBe('[REDACTED]')
      expect(redacted.config.safe_value).toBe('this is fine')
      expect(redacted.metadata.ip_address).toContain('[REDACTED]')
      expect(redacted.metadata.file_path).toContain('[REDACTED]')
    })

    it('should handle arrays with sensitive data', () => {
      const obj = {
        secrets: [
          'password123',
          'API_KEY=sk_test_456',
          'safe_string'
        ],
        users: [
          { name: 'John', password: 'secret' },
          { name: 'Jane', token: 'abc123' }
        ]
      }

      const redacted = redactObjectSensitiveData(obj)

      expect(redacted.secrets[0]).toContain('[REDACTED]')
      expect(redacted.secrets[1]).toBe('[REDACTED]')
      expect(redacted.secrets[2]).toBe('safe_string')
      expect(redacted.users[0]!.password).toBe('[REDACTED]')
      expect(redacted.users[1]!.token).toBe('[REDACTED]')
    })

    it('should respect max depth to prevent infinite recursion', () => {
      const obj: { level: number; nested?: unknown } = { level: 1 }
      obj.nested = obj // Circular reference

      const redacted = redactObjectSensitiveData(obj, 2)
      expect(redacted.level).toBe(1)
      expect(redacted.nested.level).toBe(1)
      expect(redacted.nested.nested).toBe('[MAX_DEPTH_REACHED]')
    })

    it('should handle primitive values', () => {
      expect(redactObjectSensitiveData('API_KEY=test')).toBe('[REDACTED]')
      expect(redactObjectSensitiveData(123)).toBe(123)
      expect(redactObjectSensitiveData(true)).toBe(true)
      expect(redactObjectSensitiveData(null)).toBe(null)
    })

    it('should identify sensitive keys regardless of casing', () => {
      const obj = {
        PASSWORD: 'secret',
        Secret_Key: 'secret',
        authToken: 'token',
        user_credential: 'cred',
        confidential_data: 'data'
      }

      const redacted = redactObjectSensitiveData(obj)

      expect(redacted.PASSWORD).toBe('[REDACTED]')
      expect(redacted.Secret_Key).toBe('[REDACTED]')
      expect(redacted.authToken).toBe('[REDACTED]')
      expect(redacted.user_credential).toBe('[REDACTED]')
      expect(redacted.confidential_data).toBe('[REDACTED]')
    })
  })

  describe('prepareErrorForLogging', () => {
    it('should redact sensitive data from error messages', () => {
      const error = new Error('Database connection failed: postgresql://user:password@localhost/db')
      const prepared = prepareErrorForLogging(error, true)

      expect(prepared.message).toContain('[REDACTED]')
      expect(prepared.message).not.toContain('password')
      expect(prepared.stack).toBeDefined() // Stack included when requested
    })

    it('should exclude stack trace when includeStack=false', () => {
      const error = new Error('Test error')
      const prepared = prepareErrorForLogging(error, false)

      expect(prepared.stack).toBeUndefined()
      expect(prepared.message).toBe('Test error')
    })

    it('should handle ElevateApiError with details', () => {
      const error = new ElevateApiError(
        'API error occurred',
        'TEST_ERROR',
        { 
          database_url: 'postgresql://user:secret@localhost/db',
          safe_info: 'this is ok' 
        }
      )
      const prepared = prepareErrorForLogging(error, true)

      expect(prepared.code).toBe('TEST_ERROR')
      expect(prepared.details.database_url).toContain('[REDACTED]')
      expect(prepared.details.safe_info).toBe('this is ok')
    })

    it('should redact stack traces containing file paths', () => {
      const error = new Error('Test error')
      // Simulate stack trace with file paths
      error.stack = `Error: Test error
    at /Users/admin/secret/app.js:123:45
    at /opt/app/config.json:67:89`

      const prepared = prepareErrorForLogging(error, true)

      expect(prepared.stack).toContain('[REDACTED]')
      expect(prepared.stack).not.toContain('/Users/admin/secret/app.js')
      expect(prepared.stack).not.toContain('/opt/app/config.json')
    })
  })
})

describe('Error Response Creation Tests', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createErrorResponse', () => {
    it('should never include stack traces in client responses', async () => {
      const error = new Error('Test error with sensitive data: API_KEY=secret123')
      const response = createErrorResponse(error)

      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).not.toContain('secret123')
      expect(body.stack).toBeUndefined()
      expect(body.details).toBeUndefined() // No details in client response
    })

    it('should sanitize error messages before sending to client', async () => {
      const error = new ElevateApiError(
        'Connection failed to postgresql://admin:password123@db.com:5432/prod',
        'CONNECTION_ERROR',
        { sensitive: 'data' }
      )
      const response = createErrorResponse(error)

      const body = await response.json()
      expect(body.error).toContain('[REDACTED]')
      expect(body.error).not.toContain('password123')
      expect(body.details).toBeUndefined() // Details never included in responses
    })

    it('should handle Zod validation errors', async () => {
      const schema = z.object({ name: z.string() })
      try {
        schema.parse({ name: 123 })
      } catch (zodError) {
        const response = createErrorResponse(zodError)
        const body = await response.json()

        expect(body.success).toBe(false)
        expect(body.code).toBe('VALIDATION_ERROR')
        expect(response.status).toBe(400)
      }
    })

    it('should map common error messages to specific error types', async () => {
      // Test authentication error mapping
      const authError = new Error('Unauthenticated')
      const authResponse = createErrorResponse(authError)
      const authBody = await authResponse.json()
      expect(authBody.code).toBe('UNAUTHORIZED')

      // Test authorization error mapping
      const authzError = new Error('Forbidden: Insufficient permissions')
      const authzResponse = createErrorResponse(authzError)
      const authzBody = await authzResponse.json()
      expect(authzBody.code).toBe('FORBIDDEN')
    })

    it('should hide error details in production but show in development', async () => {
      // Test production behavior
      vi.stubGlobal('process', {
        ...process,
        env: { ...process.env, NODE_ENV: 'production' }
      })

      const error = new Error('Detailed error message')
      const prodResponse = createErrorResponse(error)
      const prodBody = await prodResponse.json()
      expect(prodBody.error).toBe('An error occurred')

      // Test development behavior
      vi.stubGlobal('process', {
        ...process,
        env: { ...process.env, NODE_ENV: 'development' }
      })

      const devResponse = createErrorResponse(error)
      const devBody = await devResponse.json()
      expect(devBody.error).toBe('Detailed error message')
    })

    it('should always include trace ID and timestamp', async () => {
      const error = new Error('Test error')
      const traceId = 'custom-trace-id'
      const response = createErrorResponse(error, 500, traceId)

      const body = await response.json()
      expect(body.traceId).toBe(traceId)
      expect(body.timestamp).toBeDefined()
      expect(response.headers.get('X-Trace-Id')).toBe(traceId)
    })
  })

  describe('Error Helper Functions', () => {
    it('should create sanitized unauthorized response', async () => {
      const response = unauthorized('Invalid token: API_KEY=secret123')
      const body = await response.json()

      expect(body.error).toContain('[REDACTED]')
      expect(body.error).not.toContain('secret123')
      expect(body.code).toBe('UNAUTHORIZED')
    })

    it('should create sanitized forbidden response', async () => {
      const response = forbidden('Access denied for user: admin@company.com')
      const body = await response.json()

      expect(body.error).toContain('[REDACTED]')
      expect(body.error).not.toContain('admin@company.com')
      expect(body.code).toBe('FORBIDDEN')
    })

    it('should create sanitized not found response', async () => {
      const response = notFound('user', '/Users/admin/data/user-123.json')
      const body = await response.json()

      expect(body.error).toContain('[REDACTED]')
      expect(body.error).not.toContain('/Users/admin/data')
      expect(body.code).toBe('NOT_FOUND')
    })

    it('should create sanitized bad request response', async () => {
      const response = badRequest(
        'Invalid config file: /etc/secrets/app.conf',
        'INVALID_CONFIG',
        { filePath: '/etc/secrets/app.conf' }
      )
      const body = await response.json()

      expect(body.error).toContain('[REDACTED]')
      expect(body.error).not.toContain('/etc/secrets')
      expect(body.code).toBe('INVALID_CONFIG')
    })

    it('should create rate limit response with proper headers', () => {
      const response = rateLimitExceeded(100, 60000, 30)

      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('30')
    })

    it('should handle validation errors with sensitive data', async () => {
      const schema = z.object({
        apiKey: z.string(),
        password: z.string()
      })

      try {
        schema.parse({ apiKey: 'sk_invalid', password: 123 })
      } catch (zodError) {
        const response = validationError(zodError as z.ZodError, 'Config validation failed for /etc/secrets/config.json')
        const body = await response.json()

        expect(body.error).toContain('[REDACTED]')
        expect(body.error).not.toContain('/etc/secrets')
        expect(body.code).toBe('VALIDATION_ERROR')
      }
    })
  })
})

describe('Success Response Tests', () => {
  it('should create standardized success response', async () => {
    const data = { message: 'Operation completed' }
    const response = createSuccessResponse(data, 201)

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(data)
  })

  it('should default to 200 status', async () => {
    const response = createSuccessResponse({ test: 'data' })
    expect(response.status).toBe(200)
  })
})

describe('Utility Functions Tests', () => {
  describe('generateTraceId', () => {
    it('should generate unique trace IDs', () => {
      const id1 = generateTraceId()
      const id2 = generateTraceId()

      expect(id1).toMatch(/^trace_\d+_[a-z0-9]+$/)
      expect(id2).toMatch(/^trace_\d+_[a-z0-9]+$/)
      expect(id1).not.toBe(id2)
    })
  })

  describe('logError', () => {
    it('should redact sensitive data from logged errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const error = new Error('Database error: postgresql://user:secret@localhost/db')
      logError(error, 'trace-123', { 
        request: 'API_KEY=test123',
        safe_data: 'this is fine'
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[HIGH ERROR]'),
        expect.stringContaining('[REDACTED]')
      )
      
      const loggedData = JSON.parse(consoleSpy.mock.calls[0]?.[1])
      expect(loggedData.error.message).toContain('[REDACTED]')
      expect(loggedData.context.request).toBe('[REDACTED]')
      expect(loggedData.context.safe_data).toBe('this is fine')

      consoleSpy.mockRestore()
    })

    it('should log with appropriate severity levels', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const criticalError = new ElevateApiError('Critical', 'SERVICE_UNAVAILABLE', {})
      const mediumError = new ElevateApiError('Medium', 'RATE_LIMIT_EXCEEDED', {})
      
      logError(criticalError, 'trace-1')
      logError(mediumError, 'trace-2')

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CRITICAL ERROR]'),
        expect.any(String)
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MEDIUM ERROR]'),
        expect.any(String)
      )

      errorSpy.mockRestore()
      warnSpy.mockRestore()
    })

    it('should never log sensitive data even in stack traces', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const error = new Error('Stack trace error')
      error.stack = `Error: Stack trace error
    at sensitiveFunction (/Users/admin/.ssh/private_key.js:123:45)
    at main (postgresql://user:password@localhost/db:67:89)`

      logError(error, 'trace-123')

      const loggedData = JSON.parse(consoleSpy.mock.calls[0]?.[1])
      expect(loggedData.error.stack).toContain('[REDACTED]')
      expect(loggedData.error.stack).not.toContain('/Users/admin/.ssh/private_key.js')
      expect(loggedData.error.stack).not.toContain('postgresql://user:password@localhost/db')

      consoleSpy.mockRestore()
    })
  })
})
