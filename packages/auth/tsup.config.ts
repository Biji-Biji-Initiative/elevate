import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: [
    'src/index.ts',
    'src/context.tsx',
    'src/server-helpers.ts',
    'src/withRole.ts',
    'src/types.ts',
    'src/window-clerk.ts',
  ],
  external: ['@clerk/nextjs'],
})
