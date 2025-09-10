#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join, extname } from 'path'

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.git')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) files.push(...walk(p))
    else files.push(p)
  }
  return files
}

function readFrontMatter(content) {
  const fm = { title: '', owner: '', status: '', last_reviewed: '', tags: [] }
  const m = content.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return fm
  for (const line of m[1].split('\n')) {
    const [k, ...rest] = line.split(':')
    const v = rest.join(':').trim()
    if (k === 'title') fm.title = v.replace(/^['"]|['"]$/g, '')
    if (k === 'owner') fm.owner = v
    if (k === 'status') fm.status = v
    if (k === 'last_reviewed') fm.last_reviewed = v
    if (k === 'tags') fm.tags = v
  }
  return fm
}

function extractLinks(content) {
  const links = []
  const re = /\[([^\]]+)\]\(([^\)]+)\)/g
  let m
  while ((m = re.exec(content))) links.push({ text: m[1], href: m[2] })
  return links
}

const roots = ['docs', 'packages', 'apps', '.']
const results = []
for (const root of roots) {
  try {
    const items = walk(root)
    for (const p of items) {
      if (extname(p) !== '.md') continue
      if (p.includes('node_modules') || p.includes('/.git/')) continue
      const content = readFileSync(p, 'utf8')
      const fm = readFrontMatter(content)
      const links = extractLinks(content)
      const size = statSync(p).size
      results.push({ path: p, size, ...fm, link_count: links.length })
    }
  } catch {}
}

results.sort((a,b)=>a.path.localeCompare(b.path))
writeFileSync('reports/docs-inventory.json', JSON.stringify(results, null, 2))
console.log(`Inventory written: reports/docs-inventory.json (${results.length} docs)`) 
