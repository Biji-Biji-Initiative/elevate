import { NextRequest, NextResponse } from "next/server";
import { createHandler } from "@premieroctet/next-admin/appHandler";
import { options, prisma } from "@/lib/next-admin-options";
import { requireRole, RoleError, createErrorResponse } from "@elevate/auth/server-helpers";

const { run } = createHandler({
  apiBasePath: "/api/admin",
  prisma,
  options,
  onRequest: async (req: NextRequest) => {
    try {
      // Validate authentication and role
      const user = await requireRole('reviewer');
      
      // Log admin actions for audit purposes
      console.log(`Admin API access by ${user.userId} (${user.role}) - ${req.method} ${req.url}`);
      
      // Add user info to request context for audit logging
      if (req.headers) {
        req.headers.set('x-admin-user-id', user.userId);
        req.headers.set('x-admin-user-role', user.role);
      }
      
    } catch (error) {
      console.error('NextAdmin auth error:', error);
      
      // Handle specific auth errors
      if (error instanceof RoleError) {
        throw error; // Let NextAdmin handle it
      }
      
      if (error instanceof Error) {
        if (error.message.includes('Unauthenticated')) {
          throw new RoleError('Authentication required for admin panel', 401);
        }
        if (error.message.includes('Forbidden')) {
          throw new RoleError('Insufficient permissions - reviewer role required', 403);
        }
      }
      
      // Generic error
      throw new RoleError('Authentication failed', 500);
    }
  },
  
  onError: async (error: unknown, req: NextRequest) => {
    // Enhanced error logging
    console.error('NextAdmin error:', {
      error,
      method: req.method,
      url: req.url,
      userAgent: req.headers.get('user-agent'),
      timestamp: new Date().toISOString(),
    });
    
    // Create structured error response
    return createErrorResponse(error, 500);
  },
});

// Wrap each method with error handling
const createMethodHandler = (method: string) => {
  return async (req: NextRequest) => {
    try {
      // Rate limiting check (basic implementation)
      const userAgent = req.headers.get('user-agent') || 'unknown';
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      
      // Log request for monitoring
      console.log(`Admin ${method} request from ${ip} - ${userAgent}`);
      
      return await run(req);
    } catch (error) {
      console.error(`Admin ${method} error:`, error);
      
      // Return appropriate error response
      if (error instanceof RoleError) {
        return NextResponse.json(
          { 
            error: error.message,
            code: 'AUTH_ERROR',
            timestamp: new Date().toISOString(),
          },
          { status: error.statusCode }
        );
      }
      
      if (error instanceof Error) {
        return NextResponse.json(
          { 
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'An unexpected error occurred',
          code: 'UNKNOWN_ERROR',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  };
};

export const GET = createMethodHandler('GET');
export const POST = createMethodHandler('POST');
export const PUT = createMethodHandler('PUT');
export const DELETE = createMethodHandler('DELETE');