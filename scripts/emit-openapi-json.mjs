#!/usr/bin/env node
/**
 * Emit OpenAPI spec JSON to apps/web/public/openapi.json
 * Keeps Web app free of runtime @elevate/openapi dependency
 */
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// Try to load programmatic generator; fallback to YAML if unavailable
let getOpenApiSpec
try {
   
  const mod = await import('@elevate/openapi')
  getOpenApiSpec = mod.getOpenApiSpec
} catch (_) {
  getOpenApiSpec = null
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const root = path.join(__dirname, '..')
  const outDir = path.join(root, 'apps', 'web', 'public')
  const outFile = path.join(outDir, 'openapi.json')

  let spec
  if (typeof getOpenApiSpec === 'function') {
    spec = getOpenApiSpec()
  } else {
    // Fallback: read YAML spec and parse to JSON
    const yamlPath = path.join(root, 'docs', 'openapi.yaml')
    const yamlText = await fs.readFile(yamlPath, 'utf8')
    const { parse } = await import('yaml')
    spec = parse(yamlText)
  }
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(outFile, JSON.stringify(spec, null, 2), 'utf8')
   
  console.log(`Wrote OpenAPI spec to ${path.relative(root, outFile)}`)
}

main().catch((err) => {
   
  console.error('Failed to emit OpenAPI JSON', err)
  process.exitCode = 1
})
