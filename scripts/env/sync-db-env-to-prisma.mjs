#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const target = path.join(root, 'packages/db/.env')

function readFirstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8')
  }
  return ''
}

const sources = [
  path.join(root, '.env.local'),
  path.join(root, '.env.development.local'),
  path.join(root, '.env.development'),
]

const content = readFirstExisting(sources)
if (!content) {
  console.log('sync-db-env: no root env found; skipping')
  process.exit(0)
}

const lines = content.split(/\r?\n/)
const kv = {}
for (const line of lines) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (!m) continue
  const [, k, v] = m
  kv[k] = v
}

const db = kv['DATABASE_URL']
const direct = kv['DIRECT_URL'] || db
if (!db) {
  console.log('sync-db-env: DATABASE_URL not found in root env; skipping')
  process.exit(0)
}

const out = `DATABASE_URL=${db}\nDIRECT_URL=${direct}\n`
fs.writeFileSync(target, out)
console.log(`sync-db-env: wrote ${target}`)

