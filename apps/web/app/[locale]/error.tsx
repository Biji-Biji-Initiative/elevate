'use client'

import { useEffect } from 'react'

import Link from 'next/link'

import { Button, Alert, AlertTitle, AlertDescription } from '@elevate/ui'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to console in development
    // In production, this would be sent to an error tracking service
    console.error('App Error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              We're sorry, but something unexpected happened. Please try again or return to the homepage.
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
            <Link href="/">Go Home</Link>
          </Button>
        </div>
        
        <div className="mt-6">
          <p className="text-sm text-gray-500 text-center">
            If this problem persists, please{' '}
            <Link href="/docs" className="text-blue-600 hover:text-blue-500 underline">
              contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
