import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { saveEvidenceFile, FileValidationError } from '@elevate/storage'

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const activityCode = formData.get('activityCode') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!activityCode) {
      return NextResponse.json({ error: 'Activity code is required' }, { status: 400 })
    }

    // Validate activity code
    const validActivityCodes = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']
    if (!validActivityCodes.includes(activityCode)) {
      return NextResponse.json({ error: 'Invalid activity code' }, { status: 400 })
    }

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
    console.error('File upload error:', error)

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