#!/usr/bin/env node
// Simple check: ensure NEXT_PUBLIC_ENABLE_API_DOCS is not true in production template
// Reads root .env.production and optional apps/web/.env.production

import fs from 'node:fs'
import path from 'node:path'

function readEnvFile(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8')
    return txt
  } catch {
    return ''
  }
}

function parseEnvBoolean(contents, key) {
  const lines = contents.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const [k, ...rest] = line.split('=')
    if (!k) continue
    if (k.trim() === key) {
      const v = rest.join('=').trim()
      if (!v) return undefined
      return String(v).toLowerCase() === 'true'
    }
  }
  return undefined
}

const root = process.cwd()
const files = [
  path.join(root, '.env.production'),
  path.join(root, 'apps', 'web', '.env.production'),
]

let violation = false
for (const f of files) {
  if (!fs.existsSync(f)) continue
  const txt = readEnvFile(f)
  const isTrue = parseEnvBoolean(txt, 'NEXT_PUBLIC_ENABLE_API_DOCS')
  if (isTrue === true) {
    console.error(`❌ NEXT_PUBLIC_ENABLE_API_DOCS=true found in ${f}. This must be disabled for production.`)
    violation = true
  }
}

if (violation) {
  process.exit(1)
} else {
  console.log('✅ API docs are disabled in production templates')
}

