import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: ['src/index.ts', 'src/scoring.ts', 'src/badges.ts'],
  external: ['zod'],
})
