import path from 'path'

import { type NextRequest, type NextResponse } from 'next/server'

import { auth } from '@clerk/nextjs/server'

import { prisma } from '@elevate/db/client'
import {
  createSuccessResponse,
  createErrorResponse,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
} from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { withRateLimit, apiRateLimiter } from '@elevate/security'
import {
  getSignedUrl,
  parseStoragePath,
  deleteEvidenceFile,
} from '@elevate/storage'

export const runtime = 'nodejs'

// Enhanced path sanitization
function sanitizePath(filePath: string): {
  isValid: boolean
  sanitized: string
} {
  if (!filePath || typeof filePath !== 'string') {
    return { isValid: false, sanitized: '' }
  }

  // Remove null bytes and other dangerous characters
  const cleaned = filePath.replace(/\0/g, '').trim()

  // Check for path traversal attempts
  if (
    cleaned.includes('..') ||
    cleaned.includes('//') ||
    cleaned.startsWith('/')
  ) {
    return { isValid: false, sanitized: cleaned }
  }

  // Normalize the path and ensure it doesn't escape bounds
  const normalized = path.normalize(cleaned)
  if (normalized.includes('..') || normalized.startsWith('.')) {
    return { isValid: false, sanitized: normalized }
  }

  // Additional checks for suspicious patterns
  const suspiciousPatterns = [
    /\.\./, // Path traversal
    /\/\//, // Double slashes
    /\0/, // Null bytes
    /[<>"|*?]/, // Invalid filename characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
  ]

  if (suspiciousPatterns.some((pattern) => pattern.test(normalized))) {
    return { isValid: false, sanitized: normalized }
  }

  return { isValid: true, sanitized: normalized }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  return withRateLimit(request, apiRateLimiter, async () => {
    try {
      const baseLogger = await getSafeServerLogger('files')
      const logger = baseLogger.forRequestWithHeaders
        ? baseLogger.forRequestWithHeaders(request)
        : baseLogger
      const timerStart = Date.now()
      const { userId } = await auth()

      if (!userId) return unauthorized()

      const { path: pathSegments } = await context.params

      // Validate and sanitize each path segment
      const sanitizedSegments = pathSegments.map((segment) => {
        const result = sanitizePath(segment)
        if (!result.isValid) {
          throw new Error(`Invalid path segment: ${segment}`)
        }
        return result.sanitized
      })

      const filePath = sanitizedSegments.join('/')

      // Additional length check
      if (filePath.length > 1000) return badRequest('Path too long')

      // Parse the storage path to get user ID and activity code
      const pathInfo = parseStoragePath(filePath)
      if (!pathInfo) return badRequest('Invalid file path structure')

      // Check if the current user has access to this file
      // Users can only access their own files, or reviewers/admins can access any file
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })

      if (!currentUser) return notFound('User')

      const isOwner = pathInfo.userId === userId
      const isReviewer = ['REVIEWER', 'ADMIN', 'SUPERADMIN'].includes(
        currentUser.role,
      )

      if (!isOwner && !isReviewer) return forbidden('Access denied')

      // Additional check: ensure the file is associated with an existing submission
      // For JSON fields, we need to check if the array contains the filePath
      const submission = await prisma.submission.findFirst({
        where: {
          user_id: pathInfo.userId,
          activity_code: pathInfo.activityCode,
        },
      })

      if (!submission) return notFound('File')

      // Generate signed URL (1 hour expiry)
      const signedUrl = await getSignedUrl(filePath, 3600)

      // Create response with security headers
      const response = createSuccessResponse({
        url: signedUrl,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      })

      // Add security headers
      response.headers.set(
        'Cache-Control',
        'private, no-cache, no-store, must-revalidate',
      )
      response.headers.set('Content-Disposition', 'attachment')
      response.headers.set('X-Content-Type-Options', 'nosniff')
      response.headers.set('X-Frame-Options', 'DENY')
      response.headers.set('Referrer-Policy', 'no-referrer')
      response.headers.set('X-Download-Options', 'noopen')

      logger.info('file.signed_url.issued', {
        path: filePath,
        userId,
        isOwner,
        isReviewer,
        durationMs: Date.now() - timerStart,
      })

      return response
    } catch (error) {
      const logger = await getSafeServerLogger('files')
      logger.error(
        'file.signed_url.error',
        error instanceof Error ? error : new Error('Unknown error'),
      )
      return createErrorResponse(new Error('Failed to access file'), 500)
    }
  })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  return withRateLimit(request, apiRateLimiter, async () => {
    try {
      const baseLogger = await getSafeServerLogger('files')
      const logger = baseLogger.forRequestWithHeaders
        ? baseLogger.forRequestWithHeaders(request)
        : baseLogger
      const timerStart = Date.now()
      const { userId } = await auth()

      if (!userId) return unauthorized()

      const { path: pathSegments } = await context.params

      // Validate and sanitize each path segment
      const sanitizedSegments = pathSegments.map((segment) => {
        const result = sanitizePath(segment)
        if (!result.isValid) {
          throw new Error(`Invalid path segment: ${segment}`)
        }
        return result.sanitized
      })

      const filePath = sanitizedSegments.join('/')

      // Additional length check
      if (filePath.length > 1000) return badRequest('Path too long')

      // Parse the storage path to get user ID and activity code
      const pathInfo = parseStoragePath(filePath)
      if (!pathInfo) return badRequest('Invalid file path structure')

      // Check if the current user owns this file
      if (pathInfo.userId !== userId) return forbidden('Access denied')

      // Only allow deletion if the associated submission is still pending
      const submission = await prisma.submission.findFirst({
        where: {
          user_id: pathInfo.userId,
          activity_code: pathInfo.activityCode,
        },
      })

      if (!submission) return notFound('File')

      if (submission.status !== 'PENDING') {
        return badRequest(
          'Cannot delete files from approved or rejected submissions',
          'INVALID_INPUT',
        )
      }

      // Remove file from Supabase Storage (implemented in storage package)
      try {
        await deleteEvidenceFile(filePath)
      } catch (e) {
        logger.error(
          'file.delete.error',
          e instanceof Error ? e : new Error('Unknown storage error'),
          { path: filePath },
        )
        return createErrorResponse(new Error('Storage deletion failed'), 502)
      }

      logger.info('file.deleted', {
        path: filePath,
        userId,
        durationMs: Date.now() - timerStart,
      })

      return createSuccessResponse({ message: 'File deleted' })
    } catch (error) {
      const logger = await getSafeServerLogger('files')
      logger.error(
        'file.delete.unhandled',
        error instanceof Error ? error : new Error('Unknown error'),
      )
      return createErrorResponse(new Error('Failed to delete file'), 500)
    }
  })
}
