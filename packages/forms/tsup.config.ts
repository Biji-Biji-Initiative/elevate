import { baseTsupClient } from '../../tsup.base.mjs'

export default baseTsupClient({
  entry: ['src/index.ts'],
  external: [
    'react-hook-form',
    'zod',
    '@hookform/resolvers',
    /^@radix-ui\//,
    'class-variance-authority',
    'tailwind-merge',
    'clsx',
  ],
})
