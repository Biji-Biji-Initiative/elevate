'use client'

import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // TODO: Log the error to an error reporting service (e.g., Sentry)
    // In production, replace with proper error tracking
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="mx-auto h-16 w-16 text-red-500 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-8">
            We're sorry, but something unexpected happened. Please try again or return to the homepage.
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="mb-6 text-left">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                Error Details (Development Only)
              </summary>
              <pre className="text-xs text-red-600 bg-red-50 p-3 rounded border overflow-auto">
                {error.message}
              </pre>
            </details>
          )}
        </div>
        
        <div className="space-y-4">
          <button 
            onClick={reset}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors w-full"
          >
            Try Again
          </button>
          
          <Link 
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors w-full"
          >
            Go Home
          </Link>
        </div>
        
        <div className="mt-8">
          <p className="text-sm text-gray-500">
            If this problem persists, please{' '}
            <a href="#" className="text-blue-600 hover:text-blue-500">
              contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}