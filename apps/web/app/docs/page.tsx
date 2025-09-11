'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import Link from 'next/link'

// Optional CSS import; guard to avoid build-time resolution failure
try {
  require('swagger-ui-react/swagger-ui.css')
} catch {
  // CSS is optional in CI/SSR builds; ignore missing module
}

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })

export default function ApiDocsPage() {
  const enabled = useMemo(() => process.env.NEXT_PUBLIC_ENABLE_API_DOCS === 'true', [])
  if (!enabled) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>API Documentation Disabled</h1>
        <p style={{ marginBottom: 16, color: '#4b5563' }}>
          API docs are disabled. Set <code>NEXT_PUBLIC_ENABLE_API_DOCS=true</code> to enable.
        </p>
        <Link href="/">Return to home</Link>
      </div>
    )
  }
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
        API Documentation
      </h1>
      <p style={{ marginBottom: 16, color: '#4b5563' }}>
        OpenAPI specification for the Elevate API. Use the UI below to explore
        endpoints.
      </p>
      <div style={{ background: 'white' }}>
        <SwaggerUI
          url="/openapi.json"
          docExpansion="list"
          defaultModelsExpandDepth={1}
        />
      </div>
    </div>
  )
}
