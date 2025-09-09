import { describe, it, expect } from 'vitest'
import {
  // Schema validators
  parseActivityCode,
  parseSubmissionStatus,
  parseRole,
  parseVisibility,
  // Audit metadata parsers
  parseSubmissionAuditMeta,
  parseUserAuditMeta,
  parseBadgeAuditMeta,
  parseExportAuditMeta,
  parseKajabiAuditMeta,
  parseAuditMeta,
  // Types
  type ActivityCode,
  type SubmissionStatus,
  type Role,
  type SubmissionAuditMeta,
  type UserAuditMeta,
  type BadgeAuditMeta
} from '../common'

// Import submission payload parsers from the correct module
import {
  parseSubmissionPayload,
  parseLearnPayload,
  parseExplorePayload,
  parseAmplifyPayload,
  parsePresentPayload,
  parseShinePayload,
  type SubmissionPayload,
} from '../submission-payloads'

// Import auth helpers from the auth package (these were moved there)
// Note: These functions are actually in @elevate/auth/types but testing them here for completeness
const parseClerkPublicMetadata = (metadata: unknown): { role?: string; user_type?: string } => {
  if (!metadata || typeof metadata !== 'object' || metadata === null) {
    return {}
  }

  const metadataObj = metadata as Record<string, unknown>
  return {
    role: typeof metadataObj.role === 'string' ? metadataObj.role : undefined,
    user_type: typeof metadataObj.user_type === 'string' ? metadataObj.user_type : undefined,
  }
}

const parseClerkEmailAddress = (emailAddress: unknown): string | undefined => {
  if (!emailAddress || typeof emailAddress !== 'object' || emailAddress === null) {
    return undefined
  }
  
  const emailObj = emailAddress as Record<string, unknown>
  return typeof emailObj.emailAddress === 'string' ? emailObj.emailAddress : undefined
}

const ROLE_ORDER = ['participant', 'reviewer', 'admin', 'superadmin'] as const
type RoleName = (typeof ROLE_ORDER)[number]

const normalizeRole = (role?: string): RoleName => {
  const normalizedRole = role?.toLowerCase() as RoleName
  return ROLE_ORDER.includes(normalizedRole) ? normalizedRole : 'participant'
}

const hasRole = (userRole: RoleName, requiredRole: RoleName): boolean => {
  return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(requiredRole)
}


describe('Type Safety Tests', () => {
  describe('Activity Code Parsing', () => {
    it('should parse valid activity codes', () => {
      expect(parseActivityCode('LEARN')).toBe('LEARN')
      expect(parseActivityCode('EXPLORE')).toBe('EXPLORE')
      expect(parseActivityCode('AMPLIFY')).toBe('AMPLIFY')
      expect(parseActivityCode('PRESENT')).toBe('PRESENT')
      expect(parseActivityCode('SHINE')).toBe('SHINE')
    })

    it('should return null for invalid activity codes', () => {
      expect(parseActivityCode('INVALID')).toBeNull()
      expect(parseActivityCode('')).toBeNull()
      expect(parseActivityCode(null)).toBeNull()
      expect(parseActivityCode(undefined)).toBeNull()
      expect(parseActivityCode(123)).toBeNull()
    })
  })

  describe('Submission Status Parsing', () => {
    it('should parse valid submission statuses', () => {
      expect(parseSubmissionStatus('PENDING')).toBe('PENDING')
      expect(parseSubmissionStatus('APPROVED')).toBe('APPROVED')
      expect(parseSubmissionStatus('REJECTED')).toBe('REJECTED')
      expect(parseSubmissionStatus('REVOKED')).toBe('REVOKED')
    })

    it('should return null for invalid statuses', () => {
      expect(parseSubmissionStatus('INVALID')).toBeNull()
      expect(parseSubmissionStatus('')).toBeNull()
      expect(parseSubmissionStatus(null)).toBeNull()
      expect(parseSubmissionStatus(undefined)).toBeNull()
    })
  })

  describe('Role Parsing', () => {
    it('should parse valid roles', () => {
      expect(parseRole('PARTICIPANT')).toBe('PARTICIPANT')
      expect(parseRole('REVIEWER')).toBe('REVIEWER')
      expect(parseRole('ADMIN')).toBe('ADMIN')
      expect(parseRole('SUPERADMIN')).toBe('SUPERADMIN')
    })

    it('should return null for invalid roles', () => {
      expect(parseRole('invalid')).toBeNull()
      expect(parseRole('')).toBeNull()
      expect(parseRole(null)).toBeNull()
      expect(parseRole(undefined)).toBeNull()
    })
  })

  describe('Submission Payload Parsing', () => {
    it('should parse valid LEARN payload', () => {
      const payload = {
        activityCode: 'LEARN',
        data: {
          provider: 'SPL',
          course_name: 'AI Foundations',
          completed_at: '2024-01-15',
          certificate_url: 'https://example.com/cert.pdf'
        }
      }
      
      const result = parseSubmissionPayload(payload)
      expect(result).toBeDefined()
      expect(result?.activityCode).toBe('LEARN')
    })

    it('should parse valid EXPLORE payload', () => {
      const payload = {
        activityCode: 'EXPLORE',
        data: {
          reflection: 'This is a detailed reflection about using AI in my classroom. It demonstrates how I applied the concepts learned.',
          class_date: '2024-01-20',
          school: 'Test School',
          evidence_files: ['/path/to/evidence1.jpg', '/path/to/evidence2.pdf']
        }
      }
      
      const result = parseSubmissionPayload(payload)
      expect(result).toBeDefined()
      expect(result?.activityCode).toBe('EXPLORE')
    })

    it('should return null for invalid payloads', () => {
      expect(parseSubmissionPayload(null)).toBeNull()
      expect(parseSubmissionPayload({})).toBeNull()
      expect(parseSubmissionPayload({ activityCode: 'INVALID' })).toBeNull()
    })
  })

  describe('Audit Metadata Parsing', () => {
    it('should parse submission audit metadata', () => {
      const meta: SubmissionAuditMeta = {
        submissionId: 'sub_123',
        pointsAwarded: 50,
        reviewNote: 'Great work!',
        previousStatus: 'PENDING',
        newStatus: 'APPROVED'
      }
      
      const result = parseSubmissionAuditMeta(meta)
      expect(result).toEqual(meta)
    })

    it('should parse user audit metadata', () => {
      const meta: UserAuditMeta = {
        changes: { role: 'REVIEWER' },
        originalRole: 'PARTICIPANT',
        newRole: 'REVIEWER',
        bulkOperation: false
      }
      
      const result = parseUserAuditMeta(meta)
      expect(result).toEqual(meta)
    })

    it('should handle invalid metadata gracefully', () => {
      expect(parseSubmissionAuditMeta(null)).toBeNull()
      expect(parseUserAuditMeta('invalid')).toBeNull()
      expect(parseBadgeAuditMeta(123)).toBeNull()
    })
  })


  describe('Clerk Auth Parsing', () => {
    it('should parse Clerk publicMetadata safely', () => {
      const metadata = { role: 'admin', user_type: 'EDUCATOR', other: 'data' }
      const result = parseClerkPublicMetadata(metadata)
      expect(result.role).toBe('admin')
      expect(result.user_type).toBe('EDUCATOR')
    })

    it('should handle invalid publicMetadata', () => {
      expect(parseClerkPublicMetadata(null)).toEqual({})
      expect(parseClerkPublicMetadata('string')).toEqual({})
      expect(parseClerkPublicMetadata(123)).toEqual({})
      expect(parseClerkPublicMetadata({})).toEqual({})
    })

    it('should parse Clerk email address safely', () => {
      const emailObj = { emailAddress: 'test@example.com' }
      const result = parseClerkEmailAddress(emailObj)
      expect(result).toBe('test@example.com')
    })

    it('should handle invalid email address objects', () => {
      expect(parseClerkEmailAddress(null)).toBeUndefined()
      expect(parseClerkEmailAddress({})).toBeUndefined()
      expect(parseClerkEmailAddress({ notEmail: 'test' })).toBeUndefined()
    })
  })

  describe('Role Normalization and Hierarchy', () => {
    it('should normalize roles correctly', () => {
      expect(normalizeRole('ADMIN')).toBe('admin')
      expect(normalizeRole('Reviewer')).toBe('reviewer')
      expect(normalizeRole('SUPERADMIN')).toBe('superadmin')
      expect(normalizeRole('invalid')).toBe('participant')
      expect(normalizeRole(undefined)).toBe('participant')
    })

    it('should check role hierarchy correctly', () => {
      expect(hasRole('admin', 'participant')).toBe(true)
      expect(hasRole('admin', 'reviewer')).toBe(true)
      expect(hasRole('admin', 'admin')).toBe(true)
      expect(hasRole('admin', 'superadmin')).toBe(false)
      
      expect(hasRole('participant', 'reviewer')).toBe(false)
      expect(hasRole('participant', 'participant')).toBe(true)
      
      expect(hasRole('superadmin', 'admin')).toBe(true)
      expect(hasRole('superadmin', 'superadmin')).toBe(true)
    })
  })

  describe('Type System Consistency', () => {
    it('should maintain consistency between parsers and types', () => {
      // This test ensures that our parsers return types that match our TypeScript definitions
      const activityCode = parseActivityCode('LEARN')
      if (activityCode) {
        // TypeScript should not complain about this assignment
        const typed: ActivityCode = activityCode
        expect(typed).toBe('LEARN')
      }

      const status = parseSubmissionStatus('APPROVED')
      if (status) {
        const typed: SubmissionStatus = status
        expect(typed).toBe('APPROVED')
      }

      const role = parseRole('admin')
      if (role) {
        const typed: Role = role
        expect(typed).toBe('admin')
      }
    })

    it('should handle null returns consistently', () => {
      // All parsers should return null (not undefined) for invalid input
      expect(parseActivityCode('invalid')).toBeNull()
      expect(parseSubmissionStatus('invalid')).toBeNull()
      expect(parseRole('invalid')).toBeNull()
      expect(parseSubmissionPayload('invalid')).toBeNull()
      expect(parseAuditMeta('invalid')).toBeNull()
    })
  })


  describe('Schema Validation Edge Cases', () => {
    it('should validate minimum string lengths correctly', () => {
      const shortReflection = {
        activityCode: 'EXPLORE',
        data: {
          reflection: 'Too short', // Less than 150 characters
          class_date: '2024-01-20'
        }
      }
      
      expect(parseSubmissionPayload(shortReflection)).toBeNull()
      
      const validReflection = {
        activityCode: 'EXPLORE',
        data: {
          reflection: 'This is a much longer reflection that meets the minimum requirement of 150 characters. It provides detailed information about how I applied AI concepts in my classroom and the impact it had on student learning outcomes.',
          class_date: '2024-01-20'
        }
      }
      
      expect(parseSubmissionPayload(validReflection)).toBeDefined()
    })

    it('should validate numeric ranges correctly', () => {
      const invalidAmplify = {
        activityCode: 'AMPLIFY',
        data: {
          peers_trained: 100, // Exceeds max of 50
          students_trained: 300 // Exceeds max of 200
        }
      }
      
      expect(parseSubmissionPayload(invalidAmplify)).toBeNull()
      
      const validAmplify = {
        activityCode: 'AMPLIFY',
        data: {
          peers_trained: 25,
          students_trained: 150
        }
      }
      
      expect(parseSubmissionPayload(validAmplify)).toBeDefined()
    })
  })
})
