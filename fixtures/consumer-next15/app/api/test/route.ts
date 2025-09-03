import { NextRequest, NextResponse } from 'next/server'
import { computePoints } from '@elevate/logic'
import { ALLOWED_FILE_TYPES } from '@elevate/storage'

// Test server-safe imports and functionality
export async function GET() {
  try {
    // Test @elevate/logic
    const learnPayload = {
      provider: 'SPL' as const,
      course: 'AI Foundations',
      completedAt: '2024-01-01'
    }
    const points = computePoints('LEARN', learnPayload)
    
    // Test @elevate/storage constants
    const fileTypes = Object.keys(ALLOWED_FILE_TYPES)
    
    return NextResponse.json({
      success: true,
      message: 'Server-side @elevate package imports working correctly',
      tests: {
        logic: { learnPoints: points },
        storage: { allowedFileTypes: fileTypes }
      },
      packages_tested: [
        '@elevate/logic',
        '@elevate/storage'
      ]
    })
  } catch (error) {
    console.error('API test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Some package imports may have issues'
    }, { status: 500 })
  }
}

// Simple POST endpoint
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    return NextResponse.json({
      success: true,
      message: 'POST endpoint working',
      receivedBody: body,
      serverTime: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}