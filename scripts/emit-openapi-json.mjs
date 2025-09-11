#!/usr/bin/env node
/**
 * Emit OpenAPI spec JSON to apps/web/public/openapi.json
 * Keeps Web app free of runtime @elevate/openapi dependency
 */
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs/promises'

import { getOpenApiSpec } from '@elevate/openapi'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const root = path.join(__dirname, '..')
  const outDir = path.join(root, 'apps', 'web', 'public')
  const outFile = path.join(outDir, 'openapi.json')

  const spec = getOpenApiSpec()
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(outFile, JSON.stringify(spec, null, 2), 'utf8')
  // eslint-disable-next-line no-console
  console.log(`Wrote OpenAPI spec to ${path.relative(root, outFile)}`)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to emit OpenAPI JSON', err)
  process.exitCode = 1
})

