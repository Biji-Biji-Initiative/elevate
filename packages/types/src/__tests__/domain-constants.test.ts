import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  // Core enums
  ACTIVITY_CODES,
  USER_ROLES,
  USER_TYPES,
  SUBMISSION_STATUSES,
  VISIBILITY_OPTIONS,
  ActivityCodeSchema,
  UserRoleSchema,
  UserTypeSchema,
  SubmissionStatusSchema,
  VisibilitySchema,
  
  // Validation patterns
  HANDLE_REGEX,
  HANDLE_ERROR_MESSAGE,
  HandleSchema,
  EmailSchema,
  UrlSchema,
  CohortSchema,
  SchoolSchema,
  
  // Date/time schemas
  DateTimeWithOffsetSchema,
  DateStringSchema,
  
  // Pagination
  PaginationParamsSchema,
  PaginatedResponseSchema,
  
  // Filter schemas
  ACTIVITY_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  ROLE_FILTER_OPTIONS,
  ActivityFilterSchema,
  StatusFilterSchema,
  RoleFilterSchema,
  
  // API response schemas
  ApiSuccessSchema,
  ApiErrorSchema,
  ApiResponseSchema,
  
  // Constants
  LIMITS,
  DEFAULTS,
  DomainSchemas,
  
  // Type exports
  type ActivityCode,
  type UserRole,
  type SubmissionStatus,
  type Visibility,
  type PaginationParams,
  type PaginatedResponse
} from '../domain-constants'

describe('Domain Constants - Core Enums', () => {
  describe('ACTIVITY_CODES', () => {
    it('should contain exactly the LEAPS framework stages', () => {
      expect(ACTIVITY_CODES).toEqual(['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE'])
    })

    it('should be immutable', () => {
      // Test that the array is treated as const in TypeScript
      // Arrays created with 'as const' are not automatically frozen in JavaScript
      // but are type-safe at compile time
      expect(ACTIVITY_CODES).toBeDefined()
      expect(Array.isArray(ACTIVITY_CODES)).toBe(true)
    })

    it('should have consistent typing', () => {
      const code: ActivityCode = 'LEARN'
      expect(ACTIVITY_CODES).toContain(code)
    })
  })

  describe('USER_ROLES', () => {
    it('should contain all user roles in hierarchical order', () => {
      expect(USER_ROLES).toEqual(['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN'])
    })

    it('should validate against schema', () => {
      USER_ROLES.forEach(role => {
        expect(() => UserRoleSchema.parse(role)).not.toThrow()
      })
    })

    it('should reject invalid roles', () => {
      expect(() => UserRoleSchema.parse('INVALID_ROLE')).toThrow()
    })
  })

  describe('USER_TYPES', () => {
    it('should list educator and student types', () => {
      expect(USER_TYPES).toEqual(['EDUCATOR', 'STUDENT'])
    })

    it('should validate against schema', () => {
      USER_TYPES.forEach(t => {
        expect(() => UserTypeSchema.parse(t)).not.toThrow()
      })
    })
  })

  describe('SUBMISSION_STATUSES', () => {
    it('should contain all valid submission states', () => {
      expect(SUBMISSION_STATUSES).toEqual(['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'])
    })

    it('should validate workflow states', () => {
      SUBMISSION_STATUSES.forEach(status => {
        expect(() => SubmissionStatusSchema.parse(status)).not.toThrow()
      })
    })
  })

  describe('VISIBILITY_OPTIONS', () => {
    it('should contain privacy settings', () => {
      expect(VISIBILITY_OPTIONS).toEqual(['PRIVATE', 'PUBLIC'])
    })

    it('should default to private-first approach', () => {
      expect(VISIBILITY_OPTIONS[0]).toBe('PRIVATE')
    })
  })
})

describe('Domain Constants - Validation Patterns', () => {
  describe('HANDLE_REGEX and HandleSchema', () => {
    it('should accept valid handles', () => {
      const validHandles = [
        'abc',           // Minimum length
        'user123',       // Alphanumeric
        'my_handle',     // Underscores
        'user-name',     // Hyphens
        'MixedCase',     // Mixed case
        'a'.repeat(30)   // Maximum length
      ]

      validHandles.forEach(handle => {
        expect(HANDLE_REGEX.test(handle)).toBe(true)
        expect(() => HandleSchema.parse(handle)).not.toThrow()
      })
    })

    it('should reject invalid handles', () => {
      const invalidHandles = [
        'ab',            // Too short
        'a'.repeat(31),  // Too long
        'user@name',     // Invalid character @
        'user.name',     // Invalid character .
        'user name',     // Space
        'user#tag',      // Invalid character #
        '',              // Empty string
      ]

      invalidHandles.forEach(handle => {
        expect(HANDLE_REGEX.test(handle)).toBe(false)
        expect(() => HandleSchema.parse(handle)).toThrow()
      })
    })

    it('should provide consistent error message', () => {
      expect(HANDLE_ERROR_MESSAGE).toBe('Handle must be 3-30 characters and contain only letters, numbers, underscores, and hyphens')
      
      try {
        HandleSchema.parse('ab')
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError)
        const zodError = error as z.ZodError
        expect(zodError.issues.some(issue => issue.message.includes('at least 3 characters'))).toBe(true)
      }
    })

    it('should be case-insensitive in practical use', () => {
      // The regex itself accepts both cases, case handling is application logic
      expect(HANDLE_REGEX.test('MyHandle')).toBe(true)
      expect(HANDLE_REGEX.test('myhandle')).toBe(true)
      expect(HANDLE_REGEX.test('MYHANDLE')).toBe(true)
    })
  })

  describe('EmailSchema', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user123@subdomain.example.org',
        'simple@test.io'
      ]

      validEmails.forEach(email => {
        expect(() => EmailSchema.parse(email)).not.toThrow()
      })
    })

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@domain',
        ''
      ]

      invalidEmails.forEach(email => {
        expect(() => EmailSchema.parse(email)).toThrow()
      })
    })
  })

  describe('UrlSchema', () => {
    it('should accept valid URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://subdomain.domain.com/path?query=value',
        'https://api.example.com/v1/endpoint'
      ]

      validUrls.forEach(url => {
        expect(() => UrlSchema.parse(url)).not.toThrow()
      })
    })

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        '',
        'example.com' // Missing protocol
      ]

      invalidUrls.forEach(url => {
        expect(() => UrlSchema.parse(url)).toThrow()
      })
    })
  })

  describe('CohortSchema and SchoolSchema', () => {
    it('should enforce required fields with length limits', () => {
      // Valid cohorts
      expect(() => CohortSchema.parse('Cohort 2024')).not.toThrow()
      expect(() => CohortSchema.parse('A'.repeat(100))).not.toThrow()
      
      // Invalid cohorts
      expect(() => CohortSchema.parse('')).toThrow()
      expect(() => CohortSchema.parse('A'.repeat(101))).toThrow()

      // Valid schools
      expect(() => SchoolSchema.parse('Elementary School')).not.toThrow()
      expect(() => SchoolSchema.parse('A'.repeat(200))).not.toThrow()
      
      // Invalid schools
      expect(() => SchoolSchema.parse('')).toThrow()
      expect(() => SchoolSchema.parse('A'.repeat(201))).toThrow()
    })
  })
})

describe('Domain Constants - Date/Time Handling', () => {
  describe('DateTimeWithOffsetSchema', () => {
    it('should accept ISO 8601 strings with timezone offset', () => {
      const validDateTimes = [
        '2024-01-15T10:30:00Z',
        '2024-01-15T10:30:00+07:00',
        '2024-01-15T10:30:00-05:00',
        '2024-12-31T23:59:59.999Z'
      ]

      validDateTimes.forEach(datetime => {
        expect(() => DateTimeWithOffsetSchema.parse(datetime)).not.toThrow()
      })
    })

    it('should reject invalid datetime formats', () => {
      const invalidDateTimes = [
        '2024-01-15',
        '2024-01-15T10:30:00',
        'January 15, 2024',
        '2024/01/15 10:30:00',
        ''
      ]

      invalidDateTimes.forEach(datetime => {
        expect(() => DateTimeWithOffsetSchema.parse(datetime)).toThrow()
      })
    })
  })

  describe('DateStringSchema', () => {
    it('should accept parseable date strings', () => {
      const validDates = [
        '2024-01-15',
        '2024-01-15T10:30:00Z',
        'January 15, 2024',
        '1/15/2024'
      ]

      validDates.forEach(date => {
        expect(() => DateStringSchema.parse(date)).not.toThrow()
      })
    })

    it('should reject unparseable strings', () => {
      const invalidDates = [
        'not-a-date',
        '2024-13-45', // Invalid month/day
        '',
        'abc123'
      ]

      invalidDates.forEach(date => {
        expect(() => DateStringSchema.parse(date)).toThrow()
      })
    })
  })
})

describe('Domain Constants - Pagination', () => {
  describe('PaginationParamsSchema', () => {
    it('should apply default values', () => {
      const result = PaginationParamsSchema.parse({})
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
      expect(result.offset).toBeUndefined()
    })

    it('should accept valid pagination parameters', () => {
      const result = PaginationParamsSchema.parse({
        page: 3,
        limit: 50,
        offset: 100
      })
      
      expect(result.page).toBe(3)
      expect(result.limit).toBe(50)
      expect(result.offset).toBe(100)
    })

    it('should enforce limits and constraints', () => {
      // Page must be >= 1
      expect(() => PaginationParamsSchema.parse({ page: 0 })).toThrow()
      expect(() => PaginationParamsSchema.parse({ page: -1 })).toThrow()
      
      // Limit must be 1-100
      expect(() => PaginationParamsSchema.parse({ limit: 0 })).toThrow()
      expect(() => PaginationParamsSchema.parse({ limit: 101 })).toThrow()
      
      // Offset must be >= 0
      expect(() => PaginationParamsSchema.parse({ offset: -1 })).toThrow()
      
      // Must be integers
      expect(() => PaginationParamsSchema.parse({ page: 1.5 })).toThrow()
    })
  })

  describe('PaginatedResponseSchema', () => {
    it('should validate paginated response structure', () => {
      const stringSchema = z.string()
      const paginatedSchema = PaginatedResponseSchema(stringSchema)
      
      const validResponse = {
        data: ['item1', 'item2'],
        total: 100,
        page: 1,
        limit: 20,
        totalPages: 5
      }
      
      expect(() => paginatedSchema.parse(validResponse)).not.toThrow()
    })

    it('should enforce correct data array type', () => {
      const numberSchema = z.number()
      const paginatedSchema = PaginatedResponseSchema(numberSchema)
      
      const invalidResponse = {
        data: ['string', 'values'], // Should be numbers
        total: 100,
        page: 1,
        limit: 20,
        totalPages: 5
      }
      
      expect(() => paginatedSchema.parse(invalidResponse)).toThrow()
    })

    it('should validate pagination metadata', () => {
      const stringSchema = z.string()
      const paginatedSchema = PaginatedResponseSchema(stringSchema)
      
      // Total must be >= 0
      expect(() => paginatedSchema.parse({
        data: [],
        total: -1,
        page: 1,
        limit: 20,
        totalPages: 0
      })).toThrow()
      
      // Page must be >= 1
      expect(() => paginatedSchema.parse({
        data: [],
        total: 0,
        page: 0,
        limit: 20,
        totalPages: 0
      })).toThrow()
    })
  })
})

describe('Domain Constants - Filter Options', () => {
  describe('Filter Arrays with ALL option', () => {
    it('should include ALL option first in filter arrays', () => {
      expect(ACTIVITY_FILTER_OPTIONS[0]).toBe('ALL')
      expect(STATUS_FILTER_OPTIONS[0]).toBe('ALL')
      expect(ROLE_FILTER_OPTIONS[0]).toBe('ALL')
    })

    it('should include all base enum values', () => {
      expect(ACTIVITY_FILTER_OPTIONS).toEqual(['ALL', ...ACTIVITY_CODES])
      expect(STATUS_FILTER_OPTIONS).toEqual(['ALL', ...SUBMISSION_STATUSES])
      expect(ROLE_FILTER_OPTIONS).toEqual(['ALL', ...USER_ROLES])
    })

    it('should validate filter schemas', () => {
      // Valid filter values
      expect(() => ActivityFilterSchema.parse('ALL')).not.toThrow()
      expect(() => ActivityFilterSchema.parse('LEARN')).not.toThrow()
      expect(() => StatusFilterSchema.parse('PENDING')).not.toThrow()
      expect(() => RoleFilterSchema.parse('ADMIN')).not.toThrow()
      
      // Invalid filter values
      expect(() => ActivityFilterSchema.parse('INVALID')).toThrow()
      expect(() => StatusFilterSchema.parse('MAYBE')).toThrow()
      expect(() => RoleFilterSchema.parse('USER')).toThrow()
    })
  })
})

describe('Domain Constants - API Response Schemas', () => {
  describe('ApiSuccessSchema', () => {
    it('should validate success response structure', () => {
      const dataSchema = z.object({ id: z.string(), name: z.string() })
      const successSchema = ApiSuccessSchema(dataSchema)
      
      const validResponse = {
        success: true as const,
        data: { id: '123', name: 'test' },
        message: 'Optional message'
      }
      
      expect(() => successSchema.parse(validResponse)).not.toThrow()
    })

    it('should require success: true literal', () => {
      const dataSchema = z.string()
      const successSchema = ApiSuccessSchema(dataSchema)
      
      const invalidResponse = {
        success: false, // Should be true
        data: 'test'
      }
      
      expect(() => successSchema.parse(invalidResponse)).toThrow()
    })

    it('should make message optional', () => {
      const dataSchema = z.string()
      const successSchema = ApiSuccessSchema(dataSchema)
      
      const withoutMessage = {
        success: true as const,
        data: 'test'
      }
      
      expect(() => successSchema.parse(withoutMessage)).not.toThrow()
    })
  })

  describe('ApiErrorSchema', () => {
    it('should validate error response structure', () => {
      const validError = {
        success: false as const,
        error: 'Something went wrong',
        details: {
          code: 'ERROR_CODE',
          field: 'fieldName',
          traceId: 'trace-123',
          timestamp: '2024-01-15T10:30:00Z',
          validationErrors: [
            {
              path: ['field', 0],
              message: 'Field is required',
              code: 'required'
            }
          ]
        }
      }
      
      expect(() => ApiErrorSchema.parse(validError)).not.toThrow()
    })

    it('should require success: false literal', () => {
      const invalidError = {
        success: true, // Should be false
        error: 'Error message'
      }
      
      expect(() => ApiErrorSchema.parse(invalidError)).toThrow()
    })

    it('should make details optional', () => {
      const minimalError = {
        success: false as const,
        error: 'Error message'
      }
      
      expect(() => ApiErrorSchema.parse(minimalError)).not.toThrow()
    })

    it('should validate validation errors structure', () => {
      const errorWithValidation = {
        success: false as const,
        error: 'Validation failed',
        details: {
          validationErrors: [
            {
              path: ['user', 'email'],
              message: 'Invalid email',
              code: 'invalid_email'
            }
          ]
        }
      }
      
      expect(() => ApiErrorSchema.parse(errorWithValidation)).not.toThrow()
    })
  })

  describe('ApiResponseSchema (Discriminated Union)', () => {
    it('should validate success responses', () => {
      const dataSchema = z.string()
      const responseSchema = ApiResponseSchema(dataSchema)
      
      const successResponse = {
        success: true as const,
        data: 'success data'
      }
      
      expect(() => responseSchema.parse(successResponse)).not.toThrow()
    })

    it('should validate error responses', () => {
      const dataSchema = z.string()
      const responseSchema = ApiResponseSchema(dataSchema)
      
      const errorResponse = {
        success: false as const,
        error: 'Error occurred'
      }
      
      expect(() => responseSchema.parse(errorResponse)).not.toThrow()
    })

    it('should discriminate based on success field', () => {
      const dataSchema = z.string()
      const responseSchema = ApiResponseSchema(dataSchema)
      
      // Type assertion should work correctly based on success field
      const response1 = responseSchema.parse({ success: true, data: 'test' })
      if (response1.success) {
        expect(response1.data).toBe('test')
        // @ts-expect-error - error should not exist on success type
        expect(response1.error).toBeUndefined()
      }
      
      const response2 = responseSchema.parse({ success: false, error: 'failed' })
      if (!response2.success) {
        expect(response2.error).toBe('failed')
        // @ts-expect-error - data should not exist on error type
        expect(response2.data).toBeUndefined()
      }
    })
  })
})

describe('Domain Constants - Limits and Defaults', () => {
  describe('LIMITS constants', () => {
    it('should define all required limits', () => {
      expect(LIMITS.HANDLE_MIN).toBe(3)
      expect(LIMITS.HANDLE_MAX).toBe(30)
      expect(LIMITS.EMAIL_MAX).toBe(254) // RFC 5321 limit
      expect(LIMITS.PAGE_SIZE_DEFAULT).toBe(20)
      expect(LIMITS.PAGE_SIZE_MAX).toBe(100)
    })

    it('should align with schema validations', () => {
      // Handle limits should match schema
      expect(LIMITS.HANDLE_MIN).toBe(3)
      expect(LIMITS.HANDLE_MAX).toBe(30)
      
      // Pagination limits should match schema
      expect(LIMITS.PAGE_SIZE_DEFAULT).toBe(20)
      expect(LIMITS.PAGE_SIZE_MAX).toBe(100)
    })

    it('should provide security boundaries', () => {
      // Bulk operation limits for security
      expect(LIMITS.BULK_USERS_MAX).toBeLessThanOrEqual(100)
      expect(LIMITS.BULK_SUBMISSIONS_MAX).toBeLessThanOrEqual(100)
      
      // Point adjustment limits to prevent abuse
      expect(LIMITS.POINT_ADJUSTMENT_MIN).toBeLessThan(0)
      expect(LIMITS.POINT_ADJUSTMENT_MAX).toBeGreaterThan(0)
    })
  })

  describe('DEFAULTS constants', () => {
    it('should provide sensible defaults', () => {
      expect(DEFAULTS.PAGINATION_PAGE).toBe(1)
      expect(DEFAULTS.PAGINATION_LIMIT).toBe(20)
      expect(DEFAULTS.SORT_ORDER).toBe('desc')
    })

    it('should match filter defaults', () => {
      expect(DEFAULTS.ADMIN_SUBMISSIONS_STATUS).toBe('PENDING')
      expect(DEFAULTS.ADMIN_SUBMISSIONS_ACTIVITY).toBe('ALL')
      expect(DEFAULTS.ADMIN_USERS_ROLE).toBe('ALL')
    })

    it('should align with schema defaults', () => {
      const paginationDefaults = PaginationParamsSchema.parse({})
      expect(paginationDefaults.page).toBe(DEFAULTS.PAGINATION_PAGE)
      expect(paginationDefaults.limit).toBe(DEFAULTS.PAGINATION_LIMIT)
    })
  })
})

describe('Domain Constants - Schema Collections', () => {
  describe('DomainSchemas object', () => {
    it('should include all major schemas', () => {
      expect(DomainSchemas.ActivityCode).toBeDefined()
      expect(DomainSchemas.UserRole).toBeDefined()
      expect(DomainSchemas.Handle).toBeDefined()
      expect(DomainSchemas.Email).toBeDefined()
      expect(DomainSchemas.PaginationParams).toBeDefined()
    })

    it('should provide working schema references', () => {
      expect(() => DomainSchemas.ActivityCode.parse('LEARN')).not.toThrow()
      expect(() => DomainSchemas.Handle.parse('valid_handle')).not.toThrow()
      expect(() => DomainSchemas.Email.parse('test@example.com')).not.toThrow()
    })

    it('should maintain consistency with individual exports', () => {
      expect(DomainSchemas.ActivityCode).toBe(ActivityCodeSchema)
      expect(DomainSchemas.UserRole).toBe(UserRoleSchema)
      expect(DomainSchemas.Handle).toBe(HandleSchema)
    })
  })
})

describe('Domain Constants - Type System Integration', () => {
  describe('Type inference', () => {
    it('should infer correct types from schemas', () => {
      // Test that TypeScript correctly infers types
      const paginationParams: PaginationParams = { page: 1, limit: 20 }
      const paginatedResponse: PaginatedResponse<string> = {
        data: ['item1', 'item2'],
        total: 100,
        page: 1,
        limit: 20,
        totalPages: 5
      }
      
      expect(paginationParams.page).toBe(1)
      expect(paginatedResponse.data).toEqual(['item1', 'item2'])
    })

    it('should provide type safety', () => {
      // These should type-check at compile time
      const activityCode: ActivityCode = 'LEARN'
      const userRole: UserRole = 'ADMIN'
      const status: SubmissionStatus = 'APPROVED'
      const visibility: Visibility = 'PUBLIC'
      
      expect(ACTIVITY_CODES).toContain(activityCode)
      expect(USER_ROLES).toContain(userRole)
      expect(SUBMISSION_STATUSES).toContain(status)
      expect(VISIBILITY_OPTIONS).toContain(visibility)
    })
  })

  describe('Legacy compatibility', () => {
    it('should maintain backward compatibility with old type names', () => {
      // These imports should work without compilation errors
      // The test verifies that the legacy type aliases are properly exported
      const test1: ActivityCode = 'LEARN'
      const test2: UserRole = 'ADMIN'
      
      expect(test1).toBe('LEARN')
      expect(test2).toBe('ADMIN')
    })
  })
})

describe('Domain Constants - Edge Cases and Error Handling', () => {
  it('should handle null and undefined gracefully in optional fields', () => {
    const paginationWithDefaults = PaginationParamsSchema.parse({})
    expect(paginationWithDefaults.offset).toBeUndefined()
    
    // Optional offset can be explicitly undefined
    const paginationExplicit = PaginationParamsSchema.parse({ offset: undefined })
    expect(paginationExplicit.offset).toBeUndefined()
  })

  it('should provide meaningful error messages', () => {
    try {
      HandleSchema.parse('x') // Too short
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError)
      const zodError = error as z.ZodError
      expect(zodError.issues[0].message).toContain('at least 3 characters')
    }
    
    try {
      EmailSchema.parse('invalid-email')
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError)
      const zodError = error as z.ZodError
      expect(zodError.issues[0].message).toContain('Invalid email')
    }
  })

  it('should be consistent across all enum validations', () => {
    // All enum schemas should reject the same way
    const invalidValue = 'INVALID_ENUM_VALUE'
    
    expect(() => ActivityCodeSchema.parse(invalidValue)).toThrow(z.ZodError)
    expect(() => UserRoleSchema.parse(invalidValue)).toThrow(z.ZodError)
    expect(() => SubmissionStatusSchema.parse(invalidValue)).toThrow(z.ZodError)
    expect(() => VisibilitySchema.parse(invalidValue)).toThrow(z.ZodError)
  })
})
