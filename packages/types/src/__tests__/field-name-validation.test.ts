import { describe, it, expect } from 'vitest'
import {
  parseSubmissionPayload,
  parseAmplifyPayload,
  parsePresentPayload,
  parseLearnPayload,
  parseExplorePayload,
  parseShinePayload
} from '../submission-payloads'

import {
  parseSubmissionApiPayload,
  parseAmplifyApiPayload,
  parsePresentApiPayload,
  parseLearnApiPayload,
  parseExploreApiPayload,
  parseShineApiPayload,
  transformApiPayloadToDb
} from '../submission-payloads.api'

/**
 * CRITICAL: Field Name Validation Tests
 * 
 * These tests ensure that:
 * 1. Database layer accepts snake_case field names (MUST PASS)
 * 2. Database layer rejects camelCase field names (MUST FAIL) 
 * 3. API layer accepts camelCase field names (MUST PASS)
 * 4. API layer rejects snake_case field names (MUST FAIL)
 * 5. Transformation functions work correctly
 * 
 * These tests prevent the production blocker where database triggers
 * expect different field names than what the application sends.
 */

describe('CRITICAL: Field Name Validation', () => {
  
  describe('Database Layer - MUST use snake_case', () => {
    
    it('AMPLIFY: should accept snake_case fields (peers_trained, students_trained, session_date)', () => {
      const validPayload = {
        activityCode: 'AMPLIFY',
        data: {
          peers_trained: 25,          // snake_case - CORRECT
          students_trained: 150,      // snake_case - CORRECT
          session_date: '2024-02-01', // required by DB schema
        }
      }
      
      const result = parseSubmissionPayload(validPayload)
      expect(result).toBeDefined()
      expect(result?.activityCode).toBe('AMPLIFY')
    })

    it('AMPLIFY: should reject camelCase fields (peersTrained, studentsTrained, sessionDate)', () => {
      const invalidPayload = {
        activityCode: 'AMPLIFY',
        data: {
          peersTrained: 25,           // camelCase - WRONG
          studentsTrained: 150,       // camelCase - WRONG
          sessionDate: '2024-02-01',  // camelCase - WRONG
        }
      }
      
      const result = parseSubmissionPayload(invalidPayload)
      expect(result).toBeNull() // Must fail validation
    })

    it('PRESENT: should accept snake_case fields (linkedin_url)', () => {
      const validPayload = {
        activityCode: 'PRESENT',
        data: {
          linkedin_url: 'https://linkedin.com/posts/123', // snake_case - CORRECT
          caption: 'My LinkedIn post about AI in education'
        }
      }
      
      const result = parseSubmissionPayload(validPayload)
      expect(result).toBeDefined()
      expect(result?.activityCode).toBe('PRESENT')
    })

    it('PRESENT: should reject camelCase fields (linkedinUrl)', () => {
      const invalidPayload = {
        activityCode: 'PRESENT',
        data: {
          linkedinUrl: 'https://linkedin.com/posts/123', // camelCase - WRONG
          caption: 'My LinkedIn post about AI in education'
        }
      }
      
      const result = parseSubmissionPayload(invalidPayload)
      expect(result).toBeNull() // Must fail validation
    })

    it('LEARN: should accept snake_case fields (course_name, certificate_url, completed_at)', () => {
      const validPayload = {
        activityCode: 'LEARN',
        data: {
          provider: 'SPL',
          course_name: 'AI Foundations',       // snake_case - CORRECT
          certificate_url: 'https://example.com/cert.pdf', // snake_case - CORRECT
          completed_at: '2024-01-15'          // snake_case - CORRECT
        }
      }
      
      const result = parseSubmissionPayload(validPayload)
      expect(result).toBeDefined()
      expect(result?.activityCode).toBe('LEARN')
    })

    it('LEARN: should reject camelCase fields (courseName, certificateUrl, completedAt)', () => {
      const invalidPayload = {
        activityCode: 'LEARN',
        data: {
          provider: 'SPL',
          courseName: 'AI Foundations',       // camelCase - WRONG
          certificateUrl: 'https://example.com/cert.pdf', // camelCase - WRONG
          completedAt: '2024-01-15'           // camelCase - WRONG
        }
      }
      
      const result = parseSubmissionPayload(invalidPayload)
      expect(result).toBeNull() // Must fail validation
    })

    it('EXPLORE: should accept snake_case fields (class_date, evidence_files)', () => {
      const validPayload = {
        activityCode: 'EXPLORE',
        data: {
          reflection: 'This is a long reflection about using AI in my classroom and how it improved student engagement and learning outcomes throughout the semester.',
          class_date: '2024-01-20',           // snake_case - CORRECT
          school: 'Test School',
          evidence_files: ['/path/to/evidence1.jpg'] // snake_case - CORRECT
        }
      }
      
      const result = parseSubmissionPayload(validPayload)
      expect(result).toBeDefined()
      expect(result?.activityCode).toBe('EXPLORE')
    })

    it('EXPLORE: should reject camelCase fields (classDate, evidenceFiles)', () => {
      const invalidPayload = {
        activityCode: 'EXPLORE',
        data: {
          reflection: 'This is a long reflection about using AI in my classroom and how it improved student engagement and learning outcomes throughout the semester.',
          classDate: '2024-01-20',            // camelCase - WRONG
          school: 'Test School',
          evidenceFiles: ['/path/to/evidence1.jpg'] // camelCase - WRONG
        }
      }
      
      const result = parseSubmissionPayload(invalidPayload)
      expect(result).toBeNull() // Must fail validation
    })

    it('SHINE: should accept snake_case fields (idea_title, idea_summary)', () => {
      const validPayload = {
        activityCode: 'SHINE',
        data: {
          idea_title: 'My AI Innovation',      // snake_case - CORRECT
          idea_summary: 'This is a detailed summary of my innovative AI application that transforms how students learn mathematics through personalized adaptive learning.' // snake_case - CORRECT
        }
      }
      
      const result = parseSubmissionPayload(validPayload)
      expect(result).toBeDefined()
      expect(result?.activityCode).toBe('SHINE')
    })

    it('SHINE: should reject camelCase fields (ideaTitle, ideaSummary)', () => {
      const invalidPayload = {
        activityCode: 'SHINE',
        data: {
          ideaTitle: 'My AI Innovation',       // camelCase - WRONG
          ideaSummary: 'This is a detailed summary of my innovative AI application that transforms how students learn mathematics through personalized adaptive learning.' // camelCase - WRONG
        }
      }
      
      const result = parseSubmissionPayload(invalidPayload)
      expect(result).toBeNull() // Must fail validation
    })
  })

  describe('API Layer - MUST use camelCase', () => {
    
    it('AMPLIFY: should accept camelCase fields (peersTrained, studentsTrained, sessionDate)', () => {
      const validPayload = {
        activityCode: 'AMPLIFY',
        data: {
          peersTrained: 25,           // camelCase - CORRECT for API
          studentsTrained: 150,       // camelCase - CORRECT for API
          sessionDate: '2024-02-01',  // required by API schema
        }
      }
      
      const result = parseSubmissionApiPayload(validPayload)
      expect(result).toBeDefined()
      expect(result?.activityCode).toBe('AMPLIFY')
    })

    it('AMPLIFY: should reject snake_case fields (peers_trained, students_trained, session_date)', () => {
      const invalidPayload = {
        activityCode: 'AMPLIFY',
        data: {
          peers_trained: 25,          // snake_case - WRONG for API
          students_trained: 150,      // snake_case - WRONG for API
          session_date: '2024-02-01', // snake_case - WRONG for API
        }
      }
      
      const result = parseSubmissionApiPayload(invalidPayload)
      expect(result).toBeNull() // Must fail API validation
    })

    it('PRESENT: should accept camelCase fields (linkedinUrl)', () => {
      const validPayload = {
        activityCode: 'PRESENT',
        data: {
          linkedinUrl: 'https://linkedin.com/posts/123', // camelCase - CORRECT for API
          caption: 'My LinkedIn post about AI in education'
        }
      }
      
      const result = parseSubmissionApiPayload(validPayload)
      expect(result).toBeDefined()
      expect(result?.activityCode).toBe('PRESENT')
    })

    it('PRESENT: should reject snake_case fields (linkedin_url)', () => {
      const invalidPayload = {
        activityCode: 'PRESENT',
        data: {
          linkedin_url: 'https://linkedin.com/posts/123', // snake_case - WRONG for API
          caption: 'My LinkedIn post about AI in education'
        }
      }
      
      const result = parseSubmissionApiPayload(invalidPayload)
      expect(result).toBeNull() // Must fail API validation
    })
  })

  describe('Transformation Layer - API to DB', () => {
    
    it('should transform AMPLIFY camelCase to snake_case correctly', () => {
      const apiPayload = {
        activityCode: 'AMPLIFY' as const,
        data: {
          peersTrained: 25,
          studentsTrained: 150,
          attendanceProofFiles: ['/path/to/proof.pdf']
        }
      }
      
      const dbPayload = transformApiPayloadToDb(apiPayload)
      
      expect(dbPayload.activityCode).toBe('AMPLIFY')
      expect(dbPayload.data).toEqual({
        peers_trained: 25,                    // camelCase → snake_case
        students_trained: 150,                // camelCase → snake_case  
        attendance_proof_files: ['/path/to/proof.pdf'] // camelCase → snake_case
      })
    })

    it('should transform PRESENT camelCase to snake_case correctly', () => {
      const apiPayload = {
        activityCode: 'PRESENT' as const,
        data: {
          linkedinUrl: 'https://linkedin.com/posts/123',
          screenshotUrl: 'https://example.com/screenshot.png',
          caption: 'My post'
        }
      }
      
      const dbPayload = transformApiPayloadToDb(apiPayload)
      
      expect(dbPayload.activityCode).toBe('PRESENT')
      expect(dbPayload.data).toEqual({
        linkedin_url: 'https://linkedin.com/posts/123', // camelCase → snake_case
        screenshot_url: 'https://example.com/screenshot.png', // camelCase → snake_case
        caption: 'My post'
      })
    })

    it('should transform LEARN camelCase to snake_case correctly', () => {
      const apiPayload = {
        activityCode: 'LEARN' as const,
        data: {
          provider: 'SPL' as const,
          courseName: 'AI Foundations',
          certificateUrl: 'https://example.com/cert.pdf',
          completedAt: '2024-01-15'
        }
      }
      
      const dbPayload = transformApiPayloadToDb(apiPayload)
      
      expect(dbPayload.activityCode).toBe('LEARN')
      expect(dbPayload.data).toEqual({
        provider: 'SPL',
        course_name: 'AI Foundations',       // camelCase → snake_case
        certificate_url: 'https://example.com/cert.pdf', // camelCase → snake_case
        completed_at: '2024-01-15'           // camelCase → snake_case
      })
    })
  })

  describe('End-to-End Validation - API to DB Flow', () => {
    
    it('should handle complete AMPLIFY flow: API camelCase → Transform → DB snake_case', () => {
      // Step 1: API receives camelCase
      const apiPayload = {
        activityCode: 'AMPLIFY' as const,
        data: {
          peersTrained: 30,
          studentsTrained: 120
        }
      }
      
      // Step 2: Validate API payload (should pass)
      const parsedApi = parseSubmissionApiPayload(apiPayload)
      expect(parsedApi).toBeDefined()
      
      // Step 3: Transform to DB format
      const dbPayload = transformApiPayloadToDb(parsedApi!)
      
      // Step 4: Validate DB payload (should pass)
      const parsedDb = parseSubmissionPayload(dbPayload)
      expect(parsedDb).toBeDefined()
      
      // Step 5: Verify field transformation
      expect(parsedDb!.data).toEqual({
        peers_trained: 30,     // Correctly transformed
        students_trained: 120  // Correctly transformed
      })
    })

    it('should reject invalid flow: API snake_case should fail at API layer', () => {
      // This represents a malformed API request
      const invalidApiPayload = {
        activityCode: 'AMPLIFY',
        data: {
          peers_trained: 30,    // Wrong: snake_case at API layer
          students_trained: 120 // Wrong: snake_case at API layer
        }
      }
      
      // Should fail at API validation step
      const parsedApi = parseSubmissionApiPayload(invalidApiPayload)
      expect(parsedApi).toBeNull()
    })

    it('should reject invalid flow: DB camelCase should fail at DB layer', () => {
      // This represents data that bypassed transformation (bug scenario)
      const invalidDbPayload = {
        activityCode: 'AMPLIFY',
        data: {
          peersTrained: 30,     // Wrong: camelCase at DB layer
          studentsTrained: 120  // Wrong: camelCase at DB layer
        }
      }
      
      // Should fail at DB validation step
      const parsedDb = parseSubmissionPayload(invalidDbPayload)
      expect(parsedDb).toBeNull()
    })
  })
})

/**
 * INTEGRATION WITH CI/CD PIPELINE
 * 
 * These tests should be run in CI to ensure:
 * 1. Database migrations work with snake_case fields
 * 2. API transformations work correctly 
 * 3. No regressions are introduced
 * 
 * Add this to package.json scripts:
 * "test:field-names": "vitest run field-name-validation.test.ts"
 * 
 * Add to CI pipeline:
 * - Run before any database changes
 * - Run after API changes
 * - Run on every PR that touches submission payloads
 */
