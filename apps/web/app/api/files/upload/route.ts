import { type NextRequest, NextResponse } from 'next/server'

import { auth } from '@clerk/nextjs/server'

import { saveEvidenceFile, FileValidationError } from '@elevate/storage'
import { parseActivityCode } from '@elevate/types'

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const fileEntry = formData.get('file')
    const activityCodeEntry = formData.get('activityCode')

    // Validate file is actually a File object
    if (!fileEntry || !(fileEntry instanceof File)) {
      return NextResponse.json({ error: 'No file provided or invalid file' }, { status: 400 })
    }

    // Validate activity code is a string and valid
    if (!activityCodeEntry || typeof activityCodeEntry !== 'string') {
      return NextResponse.json({ error: 'Activity code is required' }, { status: 400 })
    }

    const activityCode = parseActivityCode(activityCodeEntry)
    if (!activityCode) {
      return NextResponse.json({ error: 'Invalid activity code' }, { status: 400 })
    }

    const file = fileEntry

    const result = await saveEvidenceFile(file, userId, activityCode)

    return NextResponse.json({
      success: true,
      data: {
        path: result.path,
        hash: result.hash,
        filename: file.name,
        size: file.size,
        type: file.type
      }
    })

  } catch (error) {

    if (error instanceof FileValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
