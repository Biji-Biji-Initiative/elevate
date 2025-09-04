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
    // Copy CSS files to dist/styles
    const fs = await import('fs')
    const path = await import('path')

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
  },
})
