'use client'

import { useEffect } from 'react'

import Link from 'next/link'

import { getClientLogger } from '@elevate/logging/client'
import { Button, Alert, AlertTitle, AlertDescription } from '@elevate/ui'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Structured client-side logging (dev only by default)
    try {
      const logger = getClientLogger().forPage('admin-error-boundary')
      logger.error('Admin App Error', error)
    } catch {
      // no-op
    }
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Admin Error</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              An error occurred in the admin console. Please try again or contact system administrators.
            </p>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="text-left">
                <summary className="cursor-pointer text-sm font-mono">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 text-xs overflow-auto p-2 bg-gray-100 rounded">
                  {error.message}
                  {'\n\n'}
                  {error.stack}
                </pre>
              </details>
            )}
          </AlertDescription>
        </Alert>
        
        <div className="space-y-3">
          <Button onClick={reset} className="w-full">
            Try Again
          </Button>
          
          <Button asChild variant="outline" className="w-full">
            <Link href="/admin">Back to Admin Dashboard</Link>
          </Button>
        </div>
        
        <div className="mt-6">
          <p className="text-sm text-gray-500 text-center">
            System Error ID: {error.digest}
          </p>
        </div>
      </div>
    </div>
  )
}
