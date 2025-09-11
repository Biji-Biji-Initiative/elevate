#!/usr/bin/env node
// Build OpenAPI JSON from compiled spec (no tsx, offline-safe)
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const pkgRoot = path.join(__dirname, '..')
  const outDir = path.join(pkgRoot, 'dist')
  const outFile = path.join(outDir, 'openapi.json')

  const specMod = await import(path.join(pkgRoot, 'dist', 'js', 'spec.js'))
  const getOpenApiSpec = specMod.getOpenApiSpec
  if (typeof getOpenApiSpec !== 'function') {
    throw new Error('getOpenApiSpec() not found. Did you run tsup to build dist/js/spec.js?')
  }
  const spec = getOpenApiSpec()
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(outFile, JSON.stringify(spec, null, 2), 'utf8')
  console.log(`Wrote OpenAPI JSON: ${outFile}`)
}

main().catch((err) => {
  console.error('Failed to build OpenAPI JSON:', err)
  process.exit(1)
})

