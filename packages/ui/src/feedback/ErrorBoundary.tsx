'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'

import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Button } from '../components/ui/button'

// Dynamic client logger import (optional dependency)
type ClientLogger = {
  reactError: (
    error: Error,
    info: ErrorInfo,
    context?: Record<string, unknown>
  ) => void
  error: (
    message: string,
    error?: Error | unknown,
    context?: Record<string, unknown>
  ) => void
  userAction?: (
    action: string,
    details?: Record<string, unknown>,
    context?: Record<string, unknown>
  ) => void
  navigation?: (
    from: string,
    to: string,
    context?: Record<string, unknown>
  ) => void
}
let logger: ClientLogger | null = null
if (typeof window !== 'undefined') {
  // Optional workspace module may not exist in some consumers
  const spec = '@elevate/logging/' + 'client'
  void import(spec)
    .then((mod) => {
      const getClientLogger = (mod as { getClientLogger?: (config?: { name?: string }) => ClientLogger }).getClientLogger
      if (typeof getClientLogger === 'function') {
        logger = getClientLogger({ name: 'react-error-boundary' })
      }
    })
    .catch(() => {
      // Silent fallback; console will be used instead
    })
}

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  reportEndpoint?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorId: string | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorId: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate a unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`
    return { hasError: true, error, errorId }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with structured logging
    if (logger) {
      logger.reactError(error, errorInfo, {
        errorId: this.state.errorId,
        component: 'ErrorBoundary',
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        userAgent:
          typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      })
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Send error to server endpoint for logging (optional)
    void this.sendErrorToServer(error, errorInfo)
  }

  private async sendErrorToServer(error: Error, errorInfo: ErrorInfo) {
    // Only send to server if endpoint is configured
    if (!this.props.reportEndpoint) {
      return
    }
    
    try {
      await fetch(this.props.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'error',
          message: 'React Error Boundary caught an error',
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          context: {
            errorId: this.state.errorId,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
          },
        }),
      })
    } catch (fetchError) {
      // Silently fail - don't want to cause additional errors
      if (logger) {
        logger.error('Failed to send error to server', fetchError as Error)
      }
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: null })
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[200px] flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>
                An unexpected error occurred. Our team has been notified.
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-mono">
                      Error Details (Development)
                    </summary>
                    <pre className="mt-2 text-xs overflow-auto p-2 bg-gray-100 rounded">
                      {this.state.error?.message}
                      {'\n\n'}
                      {this.state.error?.stack}
                    </pre>
                  </details>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={this.handleRetry} variant="outline" size="sm">
                Try Again
              </Button>
              <Button onClick={this.handleReload} variant="outline" size="sm">
                Reload Page
              </Button>
            </div>

            {this.state.errorId && (
              <p className="text-xs text-muted-foreground mt-2">
                Error ID: {this.state.errorId}
              </p>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Higher-order component that wraps a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorFallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void,
  reportEndpoint?: string,
) {
  const WrappedComponent = (props: P) => {
    return (
      <ErrorBoundary 
        fallback={errorFallback} 
        {...(onError ? { onError } : {})} 
        {...(reportEndpoint ? { reportEndpoint } : {})}
      >
        <Component {...props} />
      </ErrorBoundary>
    )
  }

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name
  })`

  return WrappedComponent
}

/**
 * Hook for manually reporting errors to the logging system
 */
export function useErrorReporting() {
  const reportError = React.useCallback(
    (error: Error, context?: Record<string, unknown>) => {
      if (logger) {
        logger.error('Manually reported error', error, {
          action: 'manual_error_report',
          ...context,
        })
      }
    },
    [],
  )

  const reportUserAction = React.useCallback(
    (action: string, details?: Record<string, unknown>) => {
      if (logger) {
        logger.userAction?.(action, details)
      }
    },
    [],
  )

  const reportNavigation = React.useCallback((from: string, to: string) => {
    if (logger) {
      logger.navigation?.(from, to)
    }
  }, [])

  return {
    reportError,
    reportUserAction,
    reportNavigation,
  }
}
