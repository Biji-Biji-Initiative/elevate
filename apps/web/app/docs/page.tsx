"use client"

import dynamic from 'next/dynamic'

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })
import 'swagger-ui-react/swagger-ui.css'

export default function ApiDocsPage() {
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>API Documentation</h1>
      <p style={{ marginBottom: 16, color: '#4b5563' }}>
        OpenAPI specification for the Elevate API. Use the UI below to explore endpoints.
      </p>
      <div style={{ background: 'white' }}>
        <SwaggerUI url="/api/docs" docExpansion="list" defaultModelsExpandDepth={1} />
      </div>
    </div>
  )
}

