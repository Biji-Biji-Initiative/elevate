/**
 * React hooks and components for CSP integration
 *
 * This module provides hooks and utilities for React components to work
 * seamlessly with Content Security Policy, including nonce handling.
 */

'use client'

import React, { useEffect, useState, type ReactNode } from 'react'

/**
 * Hook to get the CSP nonce from the current request
 * This should be used in client components that need to include inline scripts or styles
 */
export function useCSPNonce(): string | null {
  const [nonce, setNonce] = useState<string | null>(null)

  useEffect(() => {
    // Try to get nonce from meta tag (set by middleware)
    const nonceElement = document.querySelector('meta[name="csp-nonce"]')
    const nonceValue = nonceElement?.getAttribute('content')

    if (nonceValue) {
      setNonce(nonceValue)
    }
  }, [])

  return nonce
}

/**
 * Props for the CSPScript component
 */
interface CSPScriptProps {
  children: string
  id?: string
  type?: string
  defer?: boolean
  async?: boolean
}

/**
 * A script component that automatically includes the CSP nonce
 * Use this instead of regular <script> tags for inline scripts
 */
export function CSPScript({
  children,
  id,
  type = 'text/javascript',
  defer,
  async,
}: CSPScriptProps): React.JSX.Element | null {
  const nonce = useCSPNonce()

  useEffect(() => {
    if (!nonce || !children.trim()) return

    const script = document.createElement('script')
    script.textContent = children
    script.nonce = nonce

    if (id) script.id = id
    if (type) script.type = type
    if (defer) script.defer = true
    if (async) script.async = true

    document.head.appendChild(script)

    return () => {
      // Cleanup: remove script when component unmounts
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [nonce, children, id, type, defer, async])

  // Return null - we inject the script via DOM manipulation
  return null
}

/**
 * Props for the CSPStyle component
 */
interface CSPStyleProps {
  children: string
  id?: string
  media?: string
}

/**
 * A style component that works with CSP
 * Use this for inline styles when necessary
 */
export function CSPStyle({
  children,
  id,
  media,
}: CSPStyleProps): React.JSX.Element | null {
  const nonce = useCSPNonce()

  useEffect(() => {
    if (!nonce || !children.trim()) return

    const style = document.createElement('style')
    style.textContent = children
    style.nonce = nonce

    if (id) style.id = id
    if (media) style.media = media

    document.head.appendChild(style)

    return () => {
      // Cleanup: remove style when component unmounts
      if (document.head.contains(style)) {
        document.head.removeChild(style)
      }
    }
  }, [nonce, children, id, media])

  // Return null - we inject the style via DOM manipulation
  return null
}

/**
 * Props for the NonceProvider component
 */
interface NonceProviderProps {
  nonce: string
  children: ReactNode
}

/**
 * Provider component to make nonce available to child components
 * This should be used at the root level of your app
 */
export function NonceProvider({
  nonce,
  children,
}: NonceProviderProps): React.JSX.Element {
  useEffect(() => {
    // Set nonce in meta tag for client-side access
    const existingMeta = document.querySelector('meta[name="csp-nonce"]')
    if (existingMeta) {
      existingMeta.setAttribute('content', nonce)
    } else {
      const meta = document.createElement('meta')
      meta.name = 'csp-nonce'
      meta.content = nonce
      document.head.appendChild(meta)
    }

    return () => {
      // Cleanup: remove meta tag when provider unmounts
      const meta = document.querySelector('meta[name="csp-nonce"]')
      if (meta && document.head.contains(meta)) {
        document.head.removeChild(meta)
      }
    }
  }, [nonce])

  return <>{children}</>
}

/**
 * Props for the CSPMetaTags component
 */
interface CSPMetaTagsProps {
  nonce?: string
}

/**
 * Component to inject CSP-related meta tags
 * This should be included in the <head> of your document
 */
export function CSPMetaTags({ nonce }: CSPMetaTagsProps): React.JSX.Element {
  return (
    <>
      {nonce && <meta name="csp-nonce" content={nonce} />}
      <meta name="referrer" content="strict-origin-when-cross-origin" />
      <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      <meta httpEquiv="X-Frame-Options" content="DENY" />
      <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
    </>
  )
}

/**
 * Hook to check if CSP is blocking certain actions
 * Useful for debugging and fallback behavior
 */
export function useCSPViolations(): {
  violations: string[]
  addViolation: (violation: string) => void
  clearViolations: () => void
} {
  const [violations, setViolations] = useState<string[]>([])

  const addViolation = (violation: string) => {
    setViolations((prev) => [...prev, violation])
  }

  const clearViolations = () => {
    setViolations([])
  }

  useEffect(() => {
    // Listen for CSP violation events
    const handleSecurityPolicyViolation = (
      event: SecurityPolicyViolationEvent,
    ) => {
      const violation = `${event.violatedDirective}: ${event.blockedURI}`
      addViolation(violation)

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('CSP Violation:', {
          directive: event.violatedDirective,
          blockedURI: event.blockedURI,
          originalPolicy: event.originalPolicy,
          sourceFile: event.sourceFile,
          lineNumber: event.lineNumber,
          columnNumber: event.columnNumber,
        })
      }
    }

    document.addEventListener(
      'securitypolicyviolation',
      handleSecurityPolicyViolation,
    )

    return () => {
      document.removeEventListener(
        'securitypolicyviolation',
        handleSecurityPolicyViolation,
      )
    }
  }, [])

  return { violations, addViolation, clearViolations }
}

/**
 * Higher-order component to wrap components with CSP nonce support
 */
export function withCSPNonce<P extends { cspNonce?: string }>(
  Component: React.ComponentType<P>,
): React.ComponentType<Omit<P, 'cspNonce'>> {
  const WrappedComponent = (props: Omit<P, 'cspNonce'>) => {
    const nonce = useCSPNonce()

    return <Component {...(props as P)} cspNonce={nonce ?? undefined} />
  }

  WrappedComponent.displayName = `withCSPNonce(${
    Component.displayName || Component.name
  })`

  return WrappedComponent
}

/**
 * Utility function to safely execute inline scripts with CSP
 * This creates a temporary script element with the correct nonce
 */
export function executeWithNonce(
  code: string,
  options?: {
    type?: string
    defer?: boolean
    async?: boolean
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const nonce = document
      .querySelector('meta[name="csp-nonce"]')
      ?.getAttribute('content')

    if (!nonce) {
      reject(new Error('CSP nonce not available'))
      return
    }

    try {
      const script = document.createElement('script')
      script.textContent = code
      script.nonce = nonce
      script.type = options?.type || 'text/javascript'

      if (options?.defer) script.defer = true
      if (options?.async) script.async = true

      script.onload = () => {
        document.head.removeChild(script)
        resolve()
      }

      script.onerror = (error) => {
        document.head.removeChild(script)
        reject(error)
      }

      document.head.appendChild(script)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Type guard to check if an element has a nonce attribute
 */
export function hasNonce(
  element: HTMLElement,
): element is HTMLElement & { nonce: string } {
  return 'nonce' in element && typeof element.nonce === 'string'
}

/**
 * Utility to safely set innerHTML with CSP compliance
 * This ensures any inline scripts in the HTML get the correct nonce
 */
export function setInnerHTMLWithNonce(
  element: HTMLElement,
  html: string,
): void {
  const nonce = document
    .querySelector('meta[name="csp-nonce"]')
    ?.getAttribute('content')

  if (!nonce) {
    console.warn('CSP nonce not available, setting innerHTML without nonce')
    element.innerHTML = html
    return
  }

  // Create a temporary container to parse the HTML
  const temp = document.createElement('div')
  temp.innerHTML = html

  // Find all script tags and add nonce
  const scripts = temp.querySelectorAll('script')
  scripts.forEach((script) => {
    script.setAttribute('nonce', nonce)
  })

  // Find all style tags and add nonce
  const styles = temp.querySelectorAll('style')
  styles.forEach((style) => {
    style.setAttribute('nonce', nonce)
  })

  // Set the modified HTML
  element.innerHTML = temp.innerHTML
}
