#!/usr/bin/env node
/* eslint-env node */
/* eslint no-console: off */
import { createHash } from 'crypto'
import { readFileSync } from 'fs'

import fg from 'fast-glob'

function hash(content) {
  return createHash('sha256').update(content).digest('hex')
}

async function main() {
  const files = await fg(['src/components/ui/*.{ts,tsx}'], {
    cwd: process.cwd(),
  })
  const summaries = []
  for (const f of files) {
    const content = readFileSync(f, 'utf8')
    // Strip whitespace and quotes differences to minimize noise
    const normalized = content.replace(/[\s'"`]/g, '')
    summaries.push(`${f}:${hash(normalized).slice(0, 16)}`)
  }
  // This script is a placeholder; in CI we would compare against a stored baseline
  // For now, just output the summary so drift can be reviewed if needed.
  console.log('UI registry drift summary:')
  console.log(summaries.sort().join('\n'))
}

main().catch((e) => {
  console.error('validate-registry-drift failed:', e)
  process.exit(1)
})
