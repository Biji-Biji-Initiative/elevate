#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'

const schema = readFileSync('packages/db/schema.prisma', 'utf8')
const models = [...schema.matchAll(/model\s+(\w+)\s+\{/g)].map(m=>m[1])
const enums = [...schema.matchAll(/enum\s+(\w+)\s+\{/g)].map(m=>m[1])

writeFileSync('reports/db-inventory.json', JSON.stringify({ models, enums }, null, 2))
console.log('Inventory written: reports/db-inventory.json')
