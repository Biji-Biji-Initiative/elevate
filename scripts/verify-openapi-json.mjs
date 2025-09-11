#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const root = path.join(__dirname, '..')
  const file = path.join(root, 'apps', 'web', 'public', 'openapi.json')
  const stat = await fs.stat(file)
  if (!stat || stat.size === 0) {
    throw new Error('openapi.json is missing or empty')
  }
  const content = await fs.readFile(file, 'utf8')
  try {
    const obj = JSON.parse(content)
    if (!obj || typeof obj !== 'object' || !obj.openapi) {
      throw new Error('Invalid OpenAPI JSON: missing openapi field')
    }
  } catch (err) {
    throw new Error(`Invalid openapi.json: ${(err && err.message) || 'parse error'}`)
  }
  // eslint-disable-next-line no-console
  console.log('Verified apps/web/public/openapi.json')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exitCode = 1
})

