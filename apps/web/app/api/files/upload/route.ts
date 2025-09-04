import { type NextRequest, NextResponse } from 'next/server'

import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

import { fileUploadRateLimiter, withRateLimit } from '@elevate/security/rate-limiter'
import { saveEvidenceFile, FileValidationError } from '@elevate/storage'
import { 
  parseActivityCode,
  createSuccessResponse,
  withApiErrorHandling,
  badRequest
} from '@elevate/types'
import {
  AuthenticationError,
  ValidationError,
  ElevateApiError
} from '@elevate/types/errors'

export const runtime = 'nodejs';

export const POST = withApiErrorHandling(async (request: NextRequest, context) => {
  // Apply rate limiting for file uploads
  return withRateLimit(request, fileUploadRateLimiter, async () => {
    const { userId } = await auth()
  
  if (!userId) {
    throw new AuthenticationError()
  }

  const formData = await request.formData()
  const fileEntry = formData.get('file')
  const activityCodeEntry = formData.get('activityCode')

  // Validate file is actually a File object
  if (!fileEntry || !(fileEntry instanceof File)) {
    throw new ValidationError(
      new z.ZodError([{ code: 'custom', message: 'No file provided or invalid file', path: ['file'] }]),
      'File validation failed',
      context.traceId
    )
  }

  // Validate activity code is a string and valid
  if (!activityCodeEntry || typeof activityCodeEntry !== 'string') {
    throw new ValidationError(
      new z.ZodError([{ code: 'custom', message: 'Activity code is required', path: ['activityCode'] }]),
      'Activity code validation failed',
      context.traceId
    )
  }

  const activityCode = parseActivityCode(activityCodeEntry)
  if (!activityCode) {
    throw new ValidationError(
      new z.ZodError([{ code: 'custom', message: 'Invalid activity code', path: ['activityCode'] }]),
      'Invalid activity code',
      context.traceId
    )
  }

  const file = fileEntry

  try {
    const result = await saveEvidenceFile(file, userId, activityCode)

    return createSuccessResponse({
      path: result.path,
      hash: result.hash,
      filename: file.name,
      size: file.size,
      type: file.type
    }, 201)
  } catch (error) {
    if (error instanceof FileValidationError) {
      throw new ElevateApiError(error.message, 'INVALID_FILE_TYPE', undefined, context.traceId)
    }
    throw new ElevateApiError('File upload failed', 'FILE_UPLOAD_FAILED', undefined, context.traceId)
  }
  })
})

export const GET = withApiErrorHandling(async (request: NextRequest, context) => {
  throw new ElevateApiError('Method not allowed', 'INVALID_INPUT', undefined, context.traceId)
})
