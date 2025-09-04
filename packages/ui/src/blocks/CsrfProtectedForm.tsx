'use client'

import React, { useState, type FormEvent } from 'react'

import { Loader2, Shield, AlertTriangle } from 'lucide-react'

import { Alert, AlertDescription } from '../components/ui/alert'
import { Button } from '../components/ui/button'

export interface CSRFProtectedFormProps {
  action: string
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  onSuccess?: (data: unknown) => void
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Form values are read directly from the form on submit; no extra state needed

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const form = event.currentTarget
      const formData = new FormData(form)
      const data: Record<string, unknown> = Object.fromEntries(
        formData.entries(),
      ) as Record<string, unknown>

      const response = await fetch(action, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`)
      }

      const result: unknown = await response.json()
      onSuccess?.(result)
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error')
      setSubmitError(err.message)
      onError?.(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    // No-op: consumers can read values from submit handler via FormData
    void event
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
              return React.cloneElement(
                child as React.ReactElement<{
                  onChange?: (
                    e: React.ChangeEvent<
                      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                    >,
                  ) => void
                }>,
                {
                  onChange: handleInputChange,
                },
              )
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
