#!/usr/bin/env node
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from 'fs'
import { dirname, join } from 'path'

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.git')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

function ensureDir(path) {
  const d = dirname(path)
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
}

const files = walk('packages').filter((p) => p.endsWith('.md'))
const archived = []

for (const p of files) {
  // Keep package README.md and api-reports
  if (p.endsWith('/README.md')) continue
  if (p.includes('/api-reports/')) continue
  // Archive everything else under archive/packages-legacy preserving structure
  const rel = p.replace(/^packages\//, '')
  const archivePath = join('archive/packages-legacy', rel)
  ensureDir(archivePath)
  // Do not overwrite existing archive (preserve original content)
  if (!existsSync(archivePath)) {
    const original = readFileSync(p, 'utf8')
    writeFileSync(archivePath, original)
  }
  // Stub
  const stub = `---\nstatus: deprecated\n---\n\n## Archived Document\n\n> This document has been archived and moved to \`archive/packages-legacy/${rel}\`.\n> See central docs hub: [docs/README.md](../../docs/README.md).\n`
  writeFileSync(p, stub)
  archived.push({ from: p, to: archivePath })
}

writeFileSync(
  'reports/package-consolidation.json',
  JSON.stringify({ archivedCount: archived.length, archived }, null, 2),
)
console.log(
  `Package docs consolidation complete. Archived ${archived.length} docs.`,
)
