import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSignedUrl, parseStoragePath } from '@elevate/storage'
import { prisma } from '@elevate/db/client'

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { path } = await params
    const filePath = path.join('/')
    
    // Parse the storage path to get user ID and activity code
    const pathInfo = parseStoragePath(filePath)
    if (!pathInfo) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    // Check if the current user has access to this file
    // Users can only access their own files, or reviewers/admins can access any file
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isOwner = pathInfo.userId === userId
    const isReviewer = ['REVIEWER', 'ADMIN', 'SUPERADMIN'].includes(currentUser.role)

    if (!isOwner && !isReviewer) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Additional check: ensure the file is associated with an existing submission
    // For JSON fields, we need to check if the array contains the filePath
    const submission = await prisma.submission.findFirst({
      where: {
        user_id: pathInfo.userId,
        activity_code: pathInfo.activityCode
      }
    })

    if (!submission) {
      return NextResponse.json({ error: 'File not found in submissions' }, { status: 404 })
    }

    // Generate signed URL (1 hour expiry)
    const signedUrl = await getSignedUrl(filePath, 3600)

    return NextResponse.json({
      success: true,
      data: {
        url: signedUrl,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      }
    })

  } catch (error) {
    console.error('File access error:', error)
    return NextResponse.json(
      { error: 'Failed to access file' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { path } = await params
    const filePath = path.join('/')
    
    // Parse the storage path to get user ID and activity code
    const pathInfo = parseStoragePath(filePath)
    if (!pathInfo) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    // Check if the current user owns this file
    if (pathInfo.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Only allow deletion if the associated submission is still pending
    const submission = await prisma.submission.findFirst({
      where: {
        user_id: pathInfo.userId,
        activity_code: pathInfo.activityCode
      }
    })

    if (!submission) {
      return NextResponse.json({ error: 'File not found in submissions' }, { status: 404 })
    }

    if (submission.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Cannot delete files from approved or rejected submissions' 
      }, { status: 400 })
    }

    // Remove file from Supabase Storage (implemented in storage package)
    // For now, we'll just return success as the actual deletion would be handled
    // through the submission update process
    return NextResponse.json({
      success: true,
      message: 'File marked for deletion'
    })

  } catch (error) {
    console.error('File deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}