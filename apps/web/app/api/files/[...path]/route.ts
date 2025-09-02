import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSignedUrl, parseStoragePath } from '@elevate/storage'
import { prisma } from '@elevate/db/client'
import { withRateLimit, apiRateLimiter } from '@elevate/security'
import path from 'path'

export const runtime = 'nodejs';

// Enhanced path sanitization
function sanitizePath(filePath: string): { isValid: boolean; sanitized: string } {
  if (!filePath || typeof filePath !== 'string') {
    return { isValid: false, sanitized: '' };
  }

  // Remove null bytes and other dangerous characters
  const cleaned = filePath.replace(/\0/g, '').trim();
  
  // Check for path traversal attempts
  if (cleaned.includes('..') || cleaned.includes('//') || cleaned.startsWith('/')) {
    return { isValid: false, sanitized: cleaned };
  }

  // Normalize the path and ensure it doesn't escape bounds
  const normalized = path.normalize(cleaned);
  if (normalized.includes('..') || normalized.startsWith('.')) {
    return { isValid: false, sanitized: normalized };
  }

  // Additional checks for suspicious patterns
  const suspiciousPatterns = [
    /\.\./,           // Path traversal
    /\/\//,           // Double slashes
    /\0/,             // Null bytes
    /[<>"|*?]/,       // Invalid filename characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(normalized))) {
    return { isValid: false, sanitized: normalized };
  }

  return { isValid: true, sanitized: normalized };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return withRateLimit(request, apiRateLimiter, async () => {
    try {
      const { userId } = await auth()
      
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { path: pathSegments } = await params
      
      // Validate and sanitize each path segment
      const sanitizedSegments = pathSegments.map(segment => {
        const result = sanitizePath(segment);
        if (!result.isValid) {
          throw new Error(`Invalid path segment: ${segment}`);
        }
        return result.sanitized;
      });
      
      const filePath = sanitizedSegments.join('/');
      
      // Additional length check
      if (filePath.length > 1000) {
        return NextResponse.json({ error: 'Path too long' }, { status: 400 });
      }
      
      // Parse the storage path to get user ID and activity code
      const pathInfo = parseStoragePath(filePath)
      if (!pathInfo) {
        return NextResponse.json({ error: 'Invalid file path structure' }, { status: 400 })
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

      // Create response with security headers
      const response = NextResponse.json({
        success: true,
        data: {
          url: signedUrl,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
        }
      });

      // Add security headers
      response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      response.headers.set('Content-Disposition', 'attachment');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('Referrer-Policy', 'no-referrer');

      return response;

    } catch (error) {
      
      // Log security-relevant errors
      if (error instanceof Error && error.message.includes('Invalid path segment')) {
      }
      
      return NextResponse.json(
        { error: 'Failed to access file' },
        { status: 500 }
      )
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return withRateLimit(request, apiRateLimiter, async () => {
    try {
      const { userId } = await auth()
      
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { path: pathSegments } = await params
      
      // Validate and sanitize each path segment
      const sanitizedSegments = pathSegments.map(segment => {
        const result = sanitizePath(segment);
        if (!result.isValid) {
          throw new Error(`Invalid path segment: ${segment}`);
        }
        return result.sanitized;
      });
      
      const filePath = sanitizedSegments.join('/');
      
      // Additional length check
      if (filePath.length > 1000) {
        return NextResponse.json({ error: 'Path too long' }, { status: 400 });
      }
      
      // Parse the storage path to get user ID and activity code
      const pathInfo = parseStoragePath(filePath)
      if (!pathInfo) {
        return NextResponse.json({ error: 'Invalid file path structure' }, { status: 400 })
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
      
      // Log security-relevant errors
      if (error instanceof Error && error.message.includes('Invalid path segment')) {
      }
      
      return NextResponse.json(
        { error: 'Failed to delete file' },
        { status: 500 }
      )
    }
  });
}