import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: ['src/index.ts', 'src/env.ts'],
  external: ['zod'],
})
