import { baseTsupClient } from '../../tsup.base.mjs'
import { defineConfig } from 'tsup'

const config = baseTsupClient({
  entry: [
    'src/index.ts',
    'src/lib/utils.ts',
    // Aggregate indexes
    'src/blocks/index.ts',
    'src/blocks/sections/index.ts',
    'src/next/index.ts',
    'src/feedback/index.ts',
    // Per-file entries to satisfy wildcard exports
    'src/blocks/*.tsx',
    'src/blocks/sections/*.tsx',
    'src/next/*.tsx',
    'src/feedback/*.tsx',
  ],
  external: [
    '@sentry/nextjs',
    /^@radix-ui\//,
    'lucide-react',
    'class-variance-authority',
    'tailwind-merge',
    'clsx',
    'react-hook-form',
    '@elevate/logging',
    '@elevate/logging/client',
  ],
})

export default defineConfig({
  ...config,
  onSuccess: async () => {
    const fs = await import('fs')
    const path = await import('path')

    // Copy CSS files to dist/styles
    const srcDir = path.resolve('src/styles')
    const destDir = path.resolve('dist/styles')

    // Create destination directory
    await fs.promises.mkdir(destDir, { recursive: true })

    // Copy globals.css
    const srcFile = path.join(srcDir, 'globals.css')
    const destFile = path.join(destDir, 'globals.css')

    try {
      await fs.promises.copyFile(srcFile, destFile)
      console.log('✓ Copied styles/globals.css to dist/styles/')
    } catch (err) {
      console.error('Failed to copy CSS files:', err)
    }

    // Add 'use client' directive to bundled files
    const jsDistDir = path.resolve('dist/js')
    const addUseClientToFile = async (filePath) => {
      try {
        const content = await fs.promises.readFile(filePath, 'utf8')
        if (!content.startsWith('"use client";') && !content.startsWith("'use client'")) {
          const newContent = '"use client";\n' + content
          await fs.promises.writeFile(filePath, newContent, 'utf8')
          console.log(`✓ Added "use client" to ${path.basename(filePath)}`)
        }
      } catch (err) {
        console.error(`Failed to add "use client" to ${filePath}:`, err)
      }
    }

    // Add to specific files that need it
    const filesToUpdate = [
      path.join(jsDistDir, 'index.js'),
      path.join(jsDistDir, 'blocks/index.js'),
      path.join(jsDistDir, 'blocks/sections/index.js'), 
      path.join(jsDistDir, 'feedback/index.js'),
      path.join(jsDistDir, 'next/index.js')
    ]

    await Promise.all(filesToUpdate.map(addUseClientToFile))
  },
})
