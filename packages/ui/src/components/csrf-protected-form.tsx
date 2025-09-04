'use client'

import React, { useState, type FormEvent } from 'react'
import { useCSRFProtectedForm } from '@elevate/security/csrf'
import { Button } from './ui/button'
import { Alert, AlertDescription } from './ui/alert'
import { Loader2, Shield, AlertTriangle } from 'lucide-react'

interface CSRFProtectedFormProps {
  action: string
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
  children: React.ReactNode
  className?: string
  submitButtonText?: string
  showSecurityIndicator?: boolean
}

/**
 * A form component with built-in CSRF protection.
 * Automatically handles token generation, validation, and error states.
 */
export function CSRFProtectedForm({
  action,
  method = 'POST',
  onSuccess,
  onError,
  children,
  className = '',
  submitButtonText = 'Submit',
  showSecurityIndicator = true,
}: CSRFProtectedFormProps) {
  const { submit, isSubmitting, submitError, tokenLoading, tokenError } =
    useCSRFProtectedForm()
  const [formData, setFormData] = useState<Record<string, any>>({})

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)
    const data = Object.fromEntries(formData.entries())

    await submit(action, data, { method, onSuccess, onError })
  }

  const handleInputChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = event.target

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? (event.target as HTMLInputElement).checked
          : value,
    }))
  }

  // Show loading state while CSRF token is being fetched
  if (tokenLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>Initializing secure form...</span>
        </div>
      </div>
    )
  }

  // Show error if CSRF token couldn't be loaded
  if (tokenError) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Security verification failed: {tokenError}
            <br />
            Please refresh the page and try again.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      {showSecurityIndicator && (
        <div className="flex items-center text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
          <Shield className="h-4 w-4 mr-2 text-green-600" />
          <span>This form is protected against CSRF attacks</span>
        </div>
      )}

      {/* Render form children with change handlers */}
      <div className="space-y-4">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            // Add onChange handler to form inputs
            if (
              child.type === 'input' ||
              child.type === 'textarea' ||
              child.type === 'select'
            ) {
              return React.cloneElement(child as React.ReactElement<any>, {
                onChange: handleInputChange,
                ...child.props,
              })
            }
          }
          return child
        })}
      </div>

      {/* Display submission errors */}
      {submitError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Submit button */}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Submitting...
          </>
        ) : (
          submitButtonText
        )}
      </Button>
    </form>
  )
}

/**
 * Higher-order component to add CSRF protection to existing forms
 */
export function withCSRFProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>,
) {
  return function CSRFProtectedComponent(props: P) {
    const { tokenLoading, tokenError } = useCSRFProtectedForm()

    if (tokenLoading) {
      return (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>Loading security token...</span>
        </div>
      )
    }

    if (tokenError) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Security verification failed. Please refresh the page and try again.
          </AlertDescription>
        </Alert>
      )
    }

    return <WrappedComponent {...props} />
  }
}
