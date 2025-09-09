#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const repoRoot = process.cwd()

const KEYS = ['DATABASE_URL', 'DIRECT_URL']
const ALLOW_PATHS = [path.join(repoRoot, 'packages/db/.env')]

function isAllowed(filePath) {
  return ALLOW_PATHS.some((p) => path.resolve(p) === path.resolve(filePath))
}

function listEnvFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      // Skip node_modules and build dirs
      if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dist') continue
      files.push(...listEnvFiles(full))
    } else if (e.isFile()) {
      if (/^\.env(\..+)?$/.test(e.name)) files.push(full)
    }
  }
  return files
}

function parseEnv(content) {
  const out = {}
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    out[m[1]] = m[2]
  }
  return out
}

function gatherRootDb() {
  const sources = [
    path.join(repoRoot, '.env.local'),
    path.join(repoRoot, '.env.development.local'),
    path.join(repoRoot, '.env.development'),
    path.join(repoRoot, '.env.defaults'),
  ]
  for (const p of sources) {
    if (!fs.existsSync(p)) continue
    const env = parseEnv(fs.readFileSync(p, 'utf8'))
    if (env.DATABASE_URL) {
      return {
        DATABASE_URL: env.DATABASE_URL.replace(/^"|"$/g, ''),
        DIRECT_URL: (env.DIRECT_URL || env.DATABASE_URL).replace(/^"|"$/g, ''),
      }
    }
  }
  return null
}

function ensureDbKeys(filePath, rootDb) {
  const original = fs.readFileSync(filePath, 'utf8')
  const lines = original.split(/\r?\n/)
  const env = parseEnv(original)
  let changed = false
  for (const k of KEYS) {
    const desired = rootDb[k]
    const present = env[k]
    if (present === undefined) {
      lines.push(`${k}=${desired}`)
      changed = true
    } else if (present.replace(/^"|"$/g, '') !== desired) {
      // rewrite line
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(`${k}=`)) {
          lines[i] = `${k}=${desired}`
          changed = true
          break
        }
      }
    }
  }
  if (changed) {
    fs.writeFileSync(filePath + '.bak', original)
    fs.writeFileSync(filePath, lines.join('\n'))
  }
  return changed
}

const rootDb = gatherRootDb()
const envFiles = listEnvFiles(repoRoot)
let changes = 0
for (const f of envFiles) {
  if (isAllowed(f)) continue
  if (f.startsWith(path.join(repoRoot, 'apps'))) {
    if (rootDb) {
      if (ensureDbKeys(f, rootDb)) changes++
    }
  }
}

if (changes > 0) {
  console.log(`env: enforce-root-env: normalized DB keys in ${changes} app env file(s) (backups *.bak)`) 
}
console.log('env: enforce-root-env: OK')

