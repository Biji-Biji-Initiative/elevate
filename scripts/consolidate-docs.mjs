#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs'
import { dirname, join } from 'path'

function loadJSON(p) { return JSON.parse(readFileSync(p,'utf8')) }

const docsInventory = loadJSON('reports/docs-inventory.json')
const coreProposal = loadJSON('reports/core-docs-proposal.json')

// Build keep set from core, README links, and critical files
const keep = new Set(coreProposal.map(d=>d.path))
keep.add('docs/openapi.yaml')
keep.add('docs/SITEMAP.md')

function extractLinksFromFile(path) {
  if (!existsSync(path)) return []
  const content = readFileSync(path,'utf8')
  const re = /\[[^\]]+\]\(([^\)]+)\)/g
  const links = []
  let m
  while ((m = re.exec(content))) links.push(m[1])
  return links
}

// Add links referenced from root and docs index to keep
for (const p of ['README.md', 'docs/README.md']) {
  for (const href of extractLinksFromFile(p)) {
    if (href.startsWith('./')) {
      const abs = p === 'README.md' ? href.replace('./','') : `docs/${href.replace('./','')}`
      keep.add(abs)
    } else if (href.startsWith('docs/')) {
      keep.add(href)
    }
  }
}

// Also keep generated docs directory
function shouldSkipPath(p) {
  if (!p.startsWith('docs/')) return true // only operate within docs/
  if (p === 'docs/README.md') return true
  if (keep.has(p)) return true
  if (p.startsWith('docs/generated/')) return true
  if (p.endsWith('.yaml')) return true
  return false
}

function ensureDir(path) { const d = dirname(path); if (!existsSync(d)) mkdirSync(d, { recursive: true }) }

const archived = []

for (const d of docsInventory) {
  const p = d.path
  // Only process markdown files under docs/
  if (!p.startsWith('docs/') || !p.endsWith('.md')) continue
  if (shouldSkipPath(p)) continue
  // Copy original to archive, then replace original with a stub
  const rel = p.replace(/^docs\//,'')
  const archivePath = join('archive/docs-legacy', rel)
  ensureDir(archivePath)
  // Write archive file with original content
  const original = readFileSync(p,'utf8')
  writeFileSync(archivePath, original)

  // Create redirect stub at original path
  const title = d.title ? d.title.replace(/^['"]|['"]$/g,'') : 'Archived Document'
  const stub = `---\n`+
               `title: ${title} (Archived)\n`+
               `owner: ${d.owner || 'platform-team'}\n`+
               `status: deprecated\n`+
               `last_reviewed: ${d.last_reviewed || new Date().toISOString().slice(0,10)}\n`+
               `tags: [archived]\n`+
               `---\n\n`+
               `## ${title} (Archived)\n\n`+
               `> This document has been archived and moved to \`archive/docs-legacy/${rel}\`.\n`+
               `> See the canonical docs hub: [docs/README.md](./README.md).\n`
  writeFileSync(p, stub)
  archived.push({ from: p, to: archivePath })
}

writeFileSync('reports/consolidation-result.json', JSON.stringify({ archivedCount: archived.length, archived }, null, 2))
console.log(`Consolidation complete. Archived ${archived.length} docs. See reports/consolidation-result.json`) 
