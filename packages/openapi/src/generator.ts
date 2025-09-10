#!/usr/bin/env node
/**
 * OpenAPI specification generator script
 *
 * Generates openapi.json specification file from Zod schemas
 */

import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { getOpenApiSpec } from './spec'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Ensure dist directory exists
const distDir = resolve(__dirname, '../dist')
mkdirSync(distDir, { recursive: true })

// Write OpenAPI spec to JSON file
const specPath = resolve(distDir, 'openapi.json')
writeFileSync(specPath, JSON.stringify(getOpenApiSpec(), null, 2), 'utf-8')

console.log(`✅ OpenAPI specification generated: ${specPath}`)
// Summary counts (avoids unsafe casts)
try {
  const spec = getOpenApiSpec()
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object'
  const endpoints = (() => {
    if (!isRecord(spec)) return 0
    if (!('paths' in spec)) return 0
    const paths = (spec as { paths?: Record<string, unknown> }).paths
    return paths ? Object.keys(paths).length : 0
  })()
  const components = (() => {
    if (!isRecord(spec)) return 0
    if (!('components' in spec)) return 0
    const c = (spec as { components?: { schemas?: Record<string, unknown> } })
      .components
    const schemas = c?.schemas
    return schemas ? Object.keys(schemas).length : 0
  })()
  console.log(`📊 Endpoints: ${endpoints}`)
  console.log(`🔧 Components: ${components} schemas`)
} catch {
  // Ignore count logging on type mismatch
}

// Generate TypeScript client types to src (single source of truth)
try {
  const { execSync } = await import('child_process')
  const srcDir = resolve(__dirname, '../src')
  const clientPath = resolve(srcDir, 'client.ts')

  execSync(`npx openapi-typescript ${specPath} -o ${clientPath}`, {
    stdio: 'inherit',
    cwd: dirname(__dirname),
  })

  console.log(`🎯 TypeScript client generated: ${clientPath}`)
} catch (error) {
  console.warn('⚠️  Failed to generate TypeScript client:', error)
  console.warn(
    '   Run manually: npx openapi-typescript dist/openapi.json -o src/client.ts',
  )
}

console.log('\n🚀 OpenAPI documentation generated successfully!')
console.log(
  '   View at: http://localhost:3000/api/docs (once Swagger UI is set up)',
)
