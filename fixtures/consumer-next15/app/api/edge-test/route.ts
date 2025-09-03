import { NextRequest, NextResponse } from 'next/server'
import { computePoints } from '@elevate/logic'

// Test edge runtime compatibility
export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    // Test that server-safe packages work in Edge Runtime
    const testStage = 'LEARN'
    const testStatus = 'PENDING'
    const testRole = 'PARTICIPANT'
    
    // Test logic functions in edge runtime
    const learnPayload = {
      provider: 'SPL' as const,
      course: 'Edge Test Course', 
      completedAt: '2024-01-01'
    }
    const points = computePoints(testStage, learnPayload)
    
    // Get search params from request
    const { searchParams } = new URL(request.url)
    const testParam = searchParams.get('test')
    
    return NextResponse.json({
      success: true,
      runtime: 'edge',
      message: 'Edge Runtime compatibility test passed',
      tests: {
        types: {
          stage: testStage,
          status: testStatus,
          role: testRole
        },
        logic: {
          points
        },
        request: {
          testParam,
          url: request.url,
          method: request.method
        }
      },
      packages_tested: [
        '@elevate/logic'
      ],
      edge_compatible: true
    })
  } catch (error) {
    console.error('Edge runtime test error:', error)
    return NextResponse.json({
      success: false,
      runtime: 'edge',
      error: error instanceof Error ? error.message : 'Unknown error',
      edge_compatible: false
    }, { status: 500 })
  }
}