'use client'

import React from 'react'

import * as Sentry from '@sentry/nextjs'

import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorBoundaryId: string
}

export interface SentryErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
  onError?: (error: Error, errorInfo: { componentStack: string }) => void
  showDetails?: boolean
  level?: 'page' | 'component' | 'section'
}

export class SentryBoundary extends React.Component<SentryErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null

  constructor(props: SentryErrorBoundaryProps) {
    super(props)
    
    this.state = {
      hasError: false,
      error: null,
      errorBoundaryId: Math.random().toString(36).substr(2, 9),
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to Sentry
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', true)
      scope.setTag('errorBoundaryId', this.state.errorBoundaryId)
      scope.setTag('level', this.props.level || 'component')
      scope.setContext('errorBoundary', {
        componentStack: errorInfo.componentStack,
        errorBoundaryId: this.state.errorBoundaryId,
      })
      Sentry.captureException(error)
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, {
        componentStack: errorInfo.componentStack || '',
      })
    }

    // Auto-retry after 10 seconds for transient errors
    if (this.isTransientError(error)) {
      this.resetTimeoutId = window.setTimeout(() => {
        this.resetError()
      }, 10000)
    }

    // Avoid console usage in library code
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  private isTransientError(error: Error): boolean {
    const transientPatterns = [
      /network/i,
      /fetch/i,
      /timeout/i,
      /connection/i,
      /chunk/i,
    ]

    return transientPatterns.some((pattern) =>
      pattern.test(error.message) || pattern.test(error.name)
    )
  }

  resetError = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
      this.resetTimeoutId = null
    }

    this.setState({
      hasError: false,
      error: null,
    })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />
      }

      // Default fallback UI
      return (
        <Card className="w-full max-w-2xl mx-auto mt-8">
          <CardHeader>
            <CardTitle className="text-red-600">Something went wrong</CardTitle>
            <CardDescription>
              An unexpected error occurred. We've been notified and are working to fix it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {this.props.showDetails && (
              <div className="bg-red-50 p-4 rounded-md">
                <h4 className="font-medium text-red-800 mb-2">Error Details</h4>
                <p className="text-sm text-red-700 font-mono">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                <details className="mt-2">
                  <summary className="text-xs text-red-600 cursor-pointer">
                    Stack Trace (Click to expand)
                  </summary>
                  <pre className="text-xs text-red-600 mt-2 whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                </details>
                <p className="text-xs text-red-500 mt-2">
                  Error ID: {this.state.errorBoundaryId}
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button onClick={this.resetError} variant="outline">
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                variant="secondary"
              >
                Reload Page
              </Button>
            </div>

            {this.isTransientError(this.state.error) && (
              <p className="text-sm text-gray-600">
                This appears to be a temporary issue. We'll automatically try again in a few seconds.
              </p>
            )}
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

// Hook-based error boundary for function components
export function useSentryErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: { componentStack?: string }) => {
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', 'hook')
      if (errorInfo?.componentStack) {
        scope.setContext('errorInfo', errorInfo)
      }
      Sentry.captureException(error)
    })
  }, [])
}

// Specialized error boundaries for different levels
export function PageErrorBoundary({ children, ...props }: Omit<SentryErrorBoundaryProps, 'level'>) {
  return (
    <SentryBoundary level="page" {...props}>
      {children}
    </SentryBoundary>
  )
}

export function ComponentErrorBoundary({ children, ...props }: Omit<SentryErrorBoundaryProps, 'level'>) {
  return (
    <SentryBoundary level="component" {...props}>
      {children}
    </SentryBoundary>
  )
}

export function SectionErrorBoundary({ children, ...props }: Omit<SentryErrorBoundaryProps, 'level'>) {
  return (
    <SentryBoundary level="section" {...props}>
      {children}
    </SentryBoundary>
  )
}
