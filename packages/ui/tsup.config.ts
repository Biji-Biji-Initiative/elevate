import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
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