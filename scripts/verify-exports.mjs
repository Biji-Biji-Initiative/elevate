#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())
const packagesDir = path.join(root, 'packages')

function fail(msg) {
  console.error(`verify-exports: ${msg}`)
  process.exitCode = 1
}

function checkPackage(pkgPath) {
  const pkgJsonPath = path.join(pkgPath, 'package.json')
  if (!fs.existsSync(pkgJsonPath)) return
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
  if (!pkg.exports) return
  const distJs = path.join(pkgPath, 'dist', 'js')
  const distTypes = path.join(pkgPath, 'dist', 'types')
  for (const [subpath, entry] of Object.entries(pkg.exports)) {
    if (subpath === './package.json') continue
    const ent = entry
    const importPath = typeof ent === 'string' ? ent : ent.import
    const typesPath = typeof ent === 'string' ? null : ent.types
    if (!importPath) continue
    const jsFile = path.join(pkgPath, importPath)
    if (!fs.existsSync(jsFile)) {
      fail(`${pkg.name}: missing JS export for ${subpath} → ${importPath}`)
    }
    if (typesPath) {
      const dtsFile = path.join(pkgPath, typesPath)
      if (!fs.existsSync(dtsFile)) {
        fail(`${pkg.name}: missing types export for ${subpath} → ${typesPath}`)
      }
    }
  }
}

function main() {
  if (!fs.existsSync(packagesDir)) {
    console.log('No packages directory found, skipping')
    return
  }
  const pkgs = fs.readdirSync(packagesDir)
  for (const name of pkgs) {
    const pkgPath = path.join(packagesDir, name)
    if (fs.statSync(pkgPath).isDirectory()) {
      checkPackage(pkgPath)
    }
  }
  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode)
  } else {
    console.log('verify-exports: OK')
  }
}

main()

