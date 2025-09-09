#!/usr/bin/env node
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return 0
  const content = fs.readFileSync(file, 'utf8')
  let count = 0
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    const [, k, v] = m
    // Respect existing to allow explicit overrides via shell
    if (process.env[k] === undefined) {
      // Strip wrapping quotes if present
      process.env[k] = v.replace(/^"|"$/g, '')
      count++
    }
  }
  return count
}

// Load env files in precedence order
const loaded = []
for (const f of [
  '.env.local',
  '.env.development.local',
  '.env.development',
  '.env.defaults',
]) {
  const p = path.join(root, f)
  const c = loadEnvFile(p)
  if (c) loaded.push(`${f}(${c})`)
}
console.log(`dev-env: loaded ${loaded.join(', ')}`)

// Enforce root-only DB
const forbidden = ['DATABASE_URL', 'DIRECT_URL']
for (const key of forbidden) {
  if (!process.env[key]) {
    console.error(`dev-env: missing ${key} in root env`)
  }
}

// Spawn concurrently
const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const args = ['run', '-s', 'dev:apps']
const child = spawn(cmd, args, { stdio: 'inherit', env: process.env })
child.on('exit', (code) => process.exit(code ?? 0))

