'use client'

import { useState, useEffect, useCallback } from 'react'

interface CSRFTokenState {
  token: string | null
  loading: boolean
  error: string | null
}

/**
 * React hook for managing CSRF tokens in client components
 */
export function useCSRFToken() {
  const [state, setState] = useState<CSRFTokenState>({
    token: null,
    loading: true,
    error: null
  })

  const fetchToken = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.statusText}`)
      }
      
      const data: unknown = await response.json()
      const tokenValue =
        typeof data === 'object' && data !== null &&
        'success' in data && (data as { success?: unknown }).success === true &&
        'data' in data && typeof (data as { data?: unknown }).data === 'object' && (data as { data?: { token?: unknown } }).data?.token
      if (!tokenValue || typeof tokenValue !== 'string') {
        throw new Error('Invalid CSRF token response')
      }
      
      setState({
        token: tokenValue,
        loading: false,
        error: null
      })
    } catch (error) {
      setState({
        token: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch CSRF token'
      })
    }
  }, [])

  const refreshToken = useCallback(() => {
    void fetchToken()
  }, [fetchToken])

  useEffect(() => {
    void fetchToken()
  }, [fetchToken])

  return {
    token: state.token,
    loading: state.loading,
    error: state.error,
    refreshToken
  }
}

/**
 * React hook for making CSRF-protected API requests
 */
export function useCSRFProtectedFetch() {
  const { token, loading, error, refreshToken } = useCSRFToken()

  const csrfFetch = useCallback(async (
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> => {
    if (loading) {
      throw new Error('CSRF token not yet loaded')
    }
    
    if (error || !token) {
      throw new Error('CSRF token not available')
    }

    const method = options.method?.toUpperCase() || 'GET'
    
    // Only add CSRF token for state-changing methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const headers = new Headers(options.headers)
      headers.set('X-CSRF-Token', token)
      headers.set('Content-Type', headers.get('Content-Type') || 'application/json')
      
      options = {
        ...options,
        headers,
        credentials: 'same-origin'
      }
    }

    const response = await fetch(url, options)
    
    // If we get a 403 with CSRF error, try to refresh token once
    if (response.status === 403) {
      try {
        const errorData: unknown = await response.clone().json()
        const code = (typeof errorData === 'object' && errorData && 'code' in errorData) ? (errorData as { code?: unknown }).code : undefined
        if (code === 'CSRF_INVALID') {
          void refreshToken()
          throw new Error('CSRF token invalid - please retry')
        }
      } catch {
        // Ignore JSON parsing errors, continue with original response
      }
    }
    
    return response
  }, [token, loading, error, refreshToken])

  return {
    csrfFetch,
    token,
    loading,
    error,
    refreshToken
  }
}

/**
 * Enhanced form submission hook with built-in CSRF protection
 */
export function useCSRFProtectedForm<T extends Record<string, unknown>>() {
  const { csrfFetch, loading: tokenLoading, error: tokenError } = useCSRFProtectedFetch()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submit = useCallback(async (
    url: string,
    data: T,
    options?: {
      method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      onSuccess?: (data: unknown) => void
      onError?: (error: Error) => void
    }
  ) => {
    const { method = 'POST', onSuccess, onError } = options || {}
    
    if (tokenLoading) {
      const error = new Error('CSRF token not yet loaded')
      onError?.(error)
      return { success: false, error: error.message }
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await csrfFetch(url, {
        method,
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const raw: unknown = await response.json().catch(() => ({ error: response.statusText }))
        const msg = (typeof raw === 'object' && raw && 'error' in raw && typeof (raw as { error?: unknown }).error === 'string')
          ? (raw as { error: string }).error
          : response.statusText
        throw new Error(msg)
      }

      const responseData: unknown = await response.json()
      onSuccess?.(responseData)
      
      return { success: true, data: responseData }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Form submission failed'
      setSubmitError(errorMessage)
      onError?.(error instanceof Error ? error : new Error(errorMessage))
      
      return { success: false, error: errorMessage }
    } finally {
      setIsSubmitting(false)
    }
  }, [csrfFetch, tokenLoading])

  return {
    submit,
    isSubmitting,
    submitError,
    tokenLoading,
    tokenError
  }
}
