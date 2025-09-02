import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  banner: {
    js: '"use client";',
  },
  external: [
    'react',
    'react-dom',
    '@radix-ui/react-slot',
    '@radix-ui/react-label',
    'class-variance-authority',
    'clsx',
    'lucide-react',
    'tailwind-merge',
    'react-hook-form'
  ],
})