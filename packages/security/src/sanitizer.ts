/**
 * User content sanitization utilities for the MS Elevate LEAPS Tracker
 * 
 * This module provides robust sanitization of user-generated content to prevent
 * XSS attacks, HTML injection, and other security vulnerabilities.
 */

import { z } from 'zod';

/**
 * HTML entities to escape for XSS prevention
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * URL schemes that are considered safe
 */
const SAFE_URL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Maximum lengths for different content types
 */
export const CONTENT_LIMITS = {
  SHORT_TEXT: 255,      // Names, titles, short descriptions
  MEDIUM_TEXT: 1000,    // Reflections, comments
  LONG_TEXT: 5000,      // Detailed descriptions, ideas
  URL: 2048,            // URLs
  EMAIL: 254,           // Email addresses
  PHONE: 20             // Phone numbers
} as const;

/**
 * Sanitization options
 */
export interface SanitizeOptions {
  maxLength?: number;
  allowedTags?: string[];
  allowNewlines?: boolean;
  preserveSpaces?: boolean;
  allowUrls?: boolean;
}

/**
 * Content validation error
 */
export class ContentValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: string
  ) {
    super(message);
    this.name = 'ContentValidationError';
  }
}

/**
 * Escape HTML entities to prevent XSS attacks
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'`=\/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Remove HTML tags from input
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize text input by removing HTML and limiting length
 */
export function sanitizeText(
  input: string,
  options: SanitizeOptions = {}
): string {
  const {
    maxLength = CONTENT_LIMITS.MEDIUM_TEXT,
    allowNewlines = true,
    preserveSpaces = true,
    allowUrls = false
  } = options;

  if (typeof input !== 'string') {
    throw new ContentValidationError('Input must be a string', 'input', String(input));
  }

  // Remove HTML tags
  let sanitized = stripHtml(input);

  // Escape remaining HTML entities
  sanitized = escapeHtml(sanitized);

  // Handle newlines
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\r\n]+/g, ' ');
  } else {
    // Normalize line endings and limit consecutive newlines
    sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  }

  // Handle spaces
  if (!preserveSpaces) {
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
  }

  // Validate URLs if present
  if (allowUrls) {
    sanitized = sanitizeUrls(sanitized);
  }

  // Trim to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim();
    // Don't break words if possible
    const lastSpace = sanitized.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) {
      sanitized = sanitized.substring(0, lastSpace);
    }
    sanitized += '...';
  }

  return sanitized;
}

/**
 * Validate and sanitize URLs
 */
export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Remove leading/trailing whitespace
  url = url.trim();

  // Check length
  if (url.length > CONTENT_LIMITS.URL) {
    return null;
  }

  try {
    // Parse URL to validate structure
    const parsed = new URL(url);
    
    // Check if scheme is safe
    if (!SAFE_URL_SCHEMES.includes(parsed.protocol)) {
      return null;
    }

    // Additional checks for suspicious patterns
    if (parsed.hostname && (
      parsed.hostname.includes('javascript') ||
      parsed.hostname.includes('data') ||
      parsed.hostname.includes('blob')
    )) {
      return null;
    }

    return parsed.href;
  } catch {
    // If URL parsing fails, try to make it a valid URL
    if (!url.match(/^https?:\/\//)) {
      try {
        const withProtocol = 'https://' + url;
        const parsed = new URL(withProtocol);
        if (SAFE_URL_SCHEMES.includes(parsed.protocol)) {
          return parsed.href;
        }
      } catch {
        // Still invalid
      }
    }
    return null;
  }
}

/**
 * Sanitize URLs within text content
 */
export function sanitizeUrls(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    const sanitized = sanitizeUrl(url);
    return sanitized || '[INVALID URL REMOVED]';
  });
}

/**
 * Validate and sanitize email addresses
 */
export function sanitizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  email = email.trim().toLowerCase();

  if (email.length > CONTENT_LIMITS.EMAIL) {
    return null;
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return null;
  }

  // Remove any HTML entities that might have been encoded
  email = email.replace(/[&<>"'`=\/]/g, '');

  return email;
}

/**
 * Validate and sanitize phone numbers
 */
export function sanitizePhone(phone: string): string | null {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.length > CONTENT_LIMITS.PHONE || cleaned.length < 7) {
    return null;
  }

  return cleaned;
}

/**
 * Sanitize submission payloads (activity-specific data)
 */
export function sanitizeSubmissionPayload(
  activityCode: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  switch (activityCode) {
    case 'LEARN':
      // Certificate submissions
      if (payload.certificateTitle && typeof payload.certificateTitle === 'string') {
        sanitized.certificateTitle = sanitizeText(payload.certificateTitle, {
          maxLength: CONTENT_LIMITS.SHORT_TEXT,
          allowNewlines: false
        });
      }
      if (payload.completionDate && typeof payload.completionDate === 'string') {
        // Date validation
        const date = new Date(payload.completionDate);
        if (!isNaN(date.getTime())) {
          sanitized.completionDate = date.toISOString().split('T')[0];
        }
      }
      break;

    case 'EXPLORE':
      // Classroom AI application with reflection
      if (payload.reflection && typeof payload.reflection === 'string') {
        sanitized.reflection = sanitizeText(payload.reflection, {
          maxLength: CONTENT_LIMITS.LONG_TEXT,
          allowNewlines: true,
          preserveSpaces: true
        });
      }
      if (payload.aiTool && typeof payload.aiTool === 'string') {
        sanitized.aiTool = sanitizeText(payload.aiTool, {
          maxLength: CONTENT_LIMITS.SHORT_TEXT,
          allowNewlines: false
        });
      }
      if (payload.subject && typeof payload.subject === 'string') {
        sanitized.subject = sanitizeText(payload.subject, {
          maxLength: CONTENT_LIMITS.SHORT_TEXT,
          allowNewlines: false
        });
      }
      if (payload.gradeLevel && typeof payload.gradeLevel === 'string') {
        sanitized.gradeLevel = sanitizeText(payload.gradeLevel, {
          maxLength: 50,
          allowNewlines: false
        });
      }
      break;

    case 'AMPLIFY':
      // Training counts
      if (payload.peersTrained && typeof payload.peersTrained === 'number') {
        sanitized.peersTrained = Math.max(0, Math.min(50, Math.floor(payload.peersTrained)));
      }
      if (payload.studentsTrained && typeof payload.studentsTrained === 'number') {
        sanitized.studentsTrained = Math.max(0, Math.min(200, Math.floor(payload.studentsTrained)));
      }
      if (payload.trainingDescription && typeof payload.trainingDescription === 'string') {
        sanitized.trainingDescription = sanitizeText(payload.trainingDescription, {
          maxLength: CONTENT_LIMITS.MEDIUM_TEXT,
          allowNewlines: true
        });
      }
      break;

    case 'PRESENT':
      // LinkedIn post with screenshot
      if (payload.linkedinUrl && typeof payload.linkedinUrl === 'string') {
        const sanitizedUrl = sanitizeUrl(payload.linkedinUrl);
        if (sanitizedUrl && sanitizedUrl.includes('linkedin.com')) {
          sanitized.linkedinUrl = sanitizedUrl;
        }
      }
      if (payload.postDescription && typeof payload.postDescription === 'string') {
        sanitized.postDescription = sanitizeText(payload.postDescription, {
          maxLength: CONTENT_LIMITS.MEDIUM_TEXT,
          allowNewlines: true
        });
      }
      break;

    case 'SHINE':
      // Innovation idea submission
      if (payload.ideaTitle && typeof payload.ideaTitle === 'string') {
        sanitized.ideaTitle = sanitizeText(payload.ideaTitle, {
          maxLength: CONTENT_LIMITS.SHORT_TEXT,
          allowNewlines: false
        });
      }
      if (payload.ideaDescription && typeof payload.ideaDescription === 'string') {
        sanitized.ideaDescription = sanitizeText(payload.ideaDescription, {
          maxLength: CONTENT_LIMITS.LONG_TEXT,
          allowNewlines: true,
          preserveSpaces: true
        });
      }
      if (payload.impactArea && typeof payload.impactArea === 'string') {
        sanitized.impactArea = sanitizeText(payload.impactArea, {
          maxLength: CONTENT_LIMITS.SHORT_TEXT,
          allowNewlines: false
        });
      }
      break;

    default:
      // For unknown activity codes, sanitize all string values
      Object.entries(payload).forEach(([key, value]) => {
        if (typeof value === 'string') {
          sanitized[key] = sanitizeText(value, {
            maxLength: CONTENT_LIMITS.MEDIUM_TEXT
          });
        } else if (typeof value === 'number') {
          sanitized[key] = value;
        } else if (typeof value === 'boolean') {
          sanitized[key] = value;
        }
        // Skip other types (objects, arrays, etc.)
      });
  }

  return sanitized;
}

/**
 * Create Zod schema for sanitized content
 */
export function createSanitizedStringSchema(
  maxLength: number = CONTENT_LIMITS.MEDIUM_TEXT,
  allowEmpty: boolean = false
) {
  let schema = z.string();
  
  if (!allowEmpty) {
    schema = schema.min(1, 'Content cannot be empty');
  }
  
  return schema
    .max(maxLength, `Content must be ${maxLength} characters or less`)
    .transform((val) => sanitizeText(val, { maxLength }));
}

/**
 * Create Zod schema for sanitized URLs
 */
export function createSanitizedUrlSchema() {
  return z.string()
    .url('Must be a valid URL')
    .max(CONTENT_LIMITS.URL, `URL must be ${CONTENT_LIMITS.URL} characters or less`)
    .transform((val) => {
      const sanitized = sanitizeUrl(val);
      if (!sanitized) {
        throw new Error('Invalid or unsafe URL');
      }
      return sanitized;
    });
}

/**
 * Create Zod schema for sanitized emails
 */
export function createSanitizedEmailSchema() {
  return z.string()
    .email('Must be a valid email address')
    .max(CONTENT_LIMITS.EMAIL, `Email must be ${CONTENT_LIMITS.EMAIL} characters or less`)
    .transform((val) => {
      const sanitized = sanitizeEmail(val);
      if (!sanitized) {
        throw new Error('Invalid email address');
      }
      return sanitized;
    });
}

/**
 * Comprehensive content sanitization for user profiles
 */
export function sanitizeUserProfile(data: {
  name?: string;
  handle?: string;
  school?: string;
  bio?: string;
  website?: string;
}): {
  name?: string;
  handle?: string;
  school?: string;
  bio?: string;
  website?: string;
} {
  const sanitized: typeof data = {};

  if (data.name) {
    sanitized.name = sanitizeText(data.name, {
      maxLength: CONTENT_LIMITS.SHORT_TEXT,
      allowNewlines: false,
      preserveSpaces: true
    });
  }

  if (data.handle) {
    // Handle should be alphanumeric with hyphens and underscores
    const cleanHandle = data.handle.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleanHandle.length >= 3 && cleanHandle.length <= 30) {
      sanitized.handle = cleanHandle;
    }
  }

  if (data.school) {
    sanitized.school = sanitizeText(data.school, {
      maxLength: CONTENT_LIMITS.SHORT_TEXT,
      allowNewlines: false,
      preserveSpaces: true
    });
  }

  if (data.bio) {
    sanitized.bio = sanitizeText(data.bio, {
      maxLength: CONTENT_LIMITS.MEDIUM_TEXT,
      allowNewlines: true,
      preserveSpaces: true
    });
  }

  if (data.website) {
    const sanitizedUrl = sanitizeUrl(data.website);
    if (sanitizedUrl) {
      sanitized.website = sanitizedUrl;
    }
  }

  return sanitized;
}

/**
 * Batch sanitize multiple strings
 */
export function sanitizeBatch(
  inputs: Record<string, string>,
  options: SanitizeOptions = {}
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  Object.entries(inputs).forEach(([key, value]) => {
    try {
      sanitized[key] = sanitizeText(value, options);
    } catch (error) {
      // Log error but continue with other fields
      console.warn(`Failed to sanitize field ${key}:`, error);
      sanitized[key] = '';
    }
  });

  return sanitized;
}

/**
 * Check if content contains potentially dangerous patterns
 */
export function containsDangerousContent(content: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /on\w+\s*=/i,        // Event handlers
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\(/i,
    /expression\(/i,
    /import\s*\(/i
  ];

  return dangerousPatterns.some(pattern => pattern.test(content));
}

/**
 * Content security validation middleware
 */
export function validateContentSecurity(content: string, field: string): void {
  if (containsDangerousContent(content)) {
    throw new ContentValidationError(
      'Content contains potentially dangerous patterns',
      field,
      content.substring(0, 100)
    );
  }
}