#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

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

function extractApiRoutes(root) {
  const files = walk(root).filter(p => /app\/api\/.+\/route\.(ts|js)$/.test(p))
  return files.map(p => ({ path: p }))
}

const web = extractApiRoutes('apps/web')
const admin = extractApiRoutes('apps/admin')

writeFileSync('reports/api-inventory.json', JSON.stringify({ web, admin }, null, 2))
console.log('Inventory written: reports/api-inventory.json')
