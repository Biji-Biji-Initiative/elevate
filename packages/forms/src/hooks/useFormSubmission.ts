import { useState, useCallback } from 'react'

export type SubmitStatus = {
  type: 'success' | 'error'
  message: string
} | null

export interface UseFormSubmissionOptions {
  onSuccess?: (data: unknown) => void
  onError?: (error: Error) => void
  successMessage?: string
  errorMessage?: string
}

export function useFormSubmission(options: UseFormSubmissionOptions = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>(null)

  const clearStatus = useCallback(() => {
    setSubmitStatus(null)
  }, [])

  const handleSubmit = useCallback(async (
    submitFn: () => Promise<unknown>
  ) => {
    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      const result = await submitFn()
      
      setSubmitStatus({
        type: 'success',
        message: options.successMessage || 'Submission successful!'
      })
      
      options.onSuccess?.(result)
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : options.errorMessage || 'An error occurred during submission'
      
      setSubmitStatus({
        type: 'error',
        message: errorMessage
      })
      
      if (error instanceof Error) {
        options.onError?.(error)
      }
      
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }, [options])

  return {
    isSubmitting,
    submitStatus,
    handleSubmit,
    clearStatus,
    setSubmitStatus
  }
}

// Type-safe version with form data
export function useTypedFormSubmission<TFormData, TResponse = void>(
  options: UseFormSubmissionOptions & {
    onSuccess?: (data: TResponse) => void
  } = {}
) {
  const base = useFormSubmission(options)
  
  const handleSubmit = useCallback(async (
    submitFn: (data: TFormData) => Promise<TResponse>,
    data: TFormData
  ) => {
    return base.handleSubmit(() => submitFn(data))
  }, [base])

  return {
    ...base,
    handleSubmit
  }
}
