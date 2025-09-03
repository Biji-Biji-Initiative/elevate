import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/FileUpload.tsx'],
  format: ['esm'],
  outDir: 'dist/js',
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
  bundle: true,
  target: 'es2022',
  banner: {
    js: '"use client";',
  },
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'next',
    'next/link',
    'next/navigation',
    '@radix-ui/react-slot',
    '@radix-ui/react-label',
    '@radix-ui/react-select',
    '@radix-ui/react-dialog',
    'class-variance-authority',
    'clsx',
    'lucide-react',
    'tailwind-merge',
    'react-hook-form',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic'
    options.jsxImportSource = 'react'
  },
})
