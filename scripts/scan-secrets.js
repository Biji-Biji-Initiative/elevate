#!/usr/bin/env node
/*
  Lightweight secret scan to catch obvious leaks in tracked files.
  This is not a replacement for professional scanners but blocks common mistakes.
*/
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = process.cwd()
const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.turbo'])
const IGNORE_FILES = [/\.env(\..*)?$/, /\.(png|jpg|jpeg|gif|svg|webp)$/i, /\.map$/]

const PATTERNS = [
  { re: /(sk|rk)_(live|test|prod)_[A-Za-z0-9]{20,}/i, why: 'Looks like a secret key token' },
  { re: /whsec_[A-Za-z0-9+/=\-_]{20,}/i, why: 'Webhook secret' },
  { re: /postgresql:\/\/[A-Za-z0-9._%-]+:[^@\s]+@[^\s]+/i, why: 'Database connection string with password' },
  { re: /SUPABASE_(SERVICE_ROLE|ANON)_KEY\s*=\s*[A-Za-z0-9.\-_]+/i, why: 'Supabase key present in file' },
  { re: /CLERK_(SECRET|PUBLISHABLE)_KEY\s*=\s*[^\s]+/i, why: 'Clerk key present in file' },
  { re: /RESEND_API_KEY\s*=\s*[^\s]+/i, why: 'Resend API key present in file' },
]

let findings = []

function shouldIgnore(name) {
  return IGNORE_FILES.some((re) => re.test(name))
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = relative(ROOT, full)
    try {
      const st = statSync(full)
      if (st.isDirectory()) {
        if (!IGNORE_DIRS.has(entry)) walk(full)
        continue
      }
      if (shouldIgnore(entry)) continue
      const content = readFileSync(full, 'utf8')
      for (const { re, why } of PATTERNS) {
        if (re.test(content)) {
          findings.push({ file: rel, why })
        }
      }
    } catch {}
  }
}

walk(ROOT)

if (findings.length) {
  console.error('❌ Potential secrets found:')
  for (const f of findings) console.error(`  - ${f.file}: ${f.why}`)
  process.exit(1)
} else {
  console.log('✅ No obvious secrets detected')
}

