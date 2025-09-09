import type { NextRequest } from 'next/server'

import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

import {
  createSuccessResponse,
  withApiErrorHandling,
  type ApiContext,
} from '@elevate/http'
import {
  fileUploadRateLimiter,
  withRateLimit,
} from '@elevate/security/rate-limiter'
import { saveEvidenceFile, FileValidationError } from '@elevate/storage'
import { parseActivityCode } from '@elevate/types'
import {
  AuthenticationError,
  ValidationError,
  ElevateApiError,
} from '@elevate/types/errors'

export const runtime = 'nodejs'

export const POST = withApiErrorHandling(
  async (request: NextRequest, context: ApiContext) => {
    // Apply rate limiting for file uploads
    return withRateLimit(request, fileUploadRateLimiter, async () => {
      const { userId } = await auth()

      if (!userId) {
        throw new AuthenticationError()
      }

      let formData: FormData
      try {
        formData = await request.formData()
      } catch (err) {
        // Undici throws if Content-Type is not multipart/form-data or urlencoded
        throw new ValidationError(
          new z.ZodError([
            {
              code: 'custom',
              message: 'Invalid or missing form data. Use multipart/form-data.',
              path: ['formData'],
            },
          ]),
          'Invalid request format',
          context.traceId,
        )
      }
      const fileEntry = formData.get('file')
      const activityCodeEntry = formData.get('activityCode')

      // Validate file is actually a File object
      if (!fileEntry || !(fileEntry instanceof File)) {
        throw new ValidationError(
          new z.ZodError([
            {
              code: 'custom',
              message: 'No file provided or invalid file',
              path: ['file'],
            },
          ]),
          'File validation failed',
          context.traceId,
        )
      }

      // Validate activity code is a string and valid
      if (!activityCodeEntry || typeof activityCodeEntry !== 'string') {
        throw new ValidationError(
          new z.ZodError([
            {
              code: 'custom',
              message: 'Activity code is required',
              path: ['activityCode'],
            },
          ]),
          'Activity code validation failed',
          context.traceId,
        )
      }

      const activityCode = parseActivityCode(activityCodeEntry)
      if (!activityCode) {
        throw new ValidationError(
          new z.ZodError([
            {
              code: 'custom',
              message: 'Invalid activity code',
              path: ['activityCode'],
            },
          ]),
          'Invalid activity code',
          context.traceId,
        )
      }

      const file = fileEntry

      try {
        const result = await saveEvidenceFile(file, userId, activityCode)

        return createSuccessResponse(
          {
            path: result.path,
            hash: result.hash,
            filename: file.name,
            size: file.size,
            type: file.type,
          },
          201,
        )
      } catch (error) {
        if (error instanceof FileValidationError) {
          throw new ElevateApiError(
            error.message,
            'INVALID_FILE_TYPE',
            undefined,
            context.traceId,
          )
        }
        throw new ElevateApiError(
          'File upload failed',
          'FILE_UPLOAD_FAILED',
          undefined,
          context.traceId,
        )
      }
    })
  },
)

export const GET = withApiErrorHandling(
  async (_request: NextRequest, context: ApiContext) => {
    throw new ElevateApiError(
      'Method not allowed',
      'INVALID_INPUT',
      undefined,
      context.traceId,
    )
  },
)
