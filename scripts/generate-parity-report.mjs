#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'

const docs = JSON.parse(readFileSync('reports/docs-inventory.json','utf8'))
const api = JSON.parse(readFileSync('reports/api-inventory.json','utf8'))
const db = JSON.parse(readFileSync('reports/db-inventory.json','utf8'))

function hasDoc(pathPart) {
  return docs.some(d => d.path.includes(pathPart))
}

const findings = {
  missing: [],
  drifts: [],
  duplicates: []
}

// API parity: ensure docs/API.md and docs/openapi.yaml exist
if (!hasDoc('docs/API.md')) findings.missing.push('docs/API.md missing')
if (!hasDoc('docs/openapi.yaml')) findings.missing.push('docs/openapi.yaml missing')

// DB parity: ensure docs/DATABASE.md exists
if (!hasDoc('docs/DATABASE.md')) findings.missing.push('docs/DATABASE.md missing')

// Core dev guide
if (!hasDoc('docs/development.md')) findings.missing.push('docs/development.md missing')

// Simple duplicate detection by title
const titleMap = new Map()
for (const d of docs) {
  const key = (d.title || '').toLowerCase()
  if (!key) continue
  if (!titleMap.has(key)) titleMap.set(key, [])
  titleMap.get(key).push(d.path)
}
for (const [title, paths] of titleMap.entries()) {
  if (paths.length > 1) findings.duplicates.push({ title, paths })
}

const report = { summary: { docs: docs.length, api_files: api.web.length + api.admin.length, db_models: db.models.length, db_enums: db.enums.length }, findings }

writeFileSync('reports/parity-report.json', JSON.stringify(report, null, 2))
console.log('Parity report written: reports/parity-report.json')
