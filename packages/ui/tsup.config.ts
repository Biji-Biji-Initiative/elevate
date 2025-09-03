import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/FileUpload.tsx'],
  format: ['esm'],
  outDir: 'dist/js',
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
  banner: {
    js: '"use client";',
  },
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@radix-ui/react-slot',
    '@radix-ui/react-label',
    'class-variance-authority',
    'clsx',
    'lucide-react',
    'tailwind-merge',
    'react-hook-form'
  ],
})
