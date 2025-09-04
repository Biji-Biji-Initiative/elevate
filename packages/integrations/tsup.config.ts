import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: ['src/index.ts', 'src/kajabi.ts', 'src/utils.ts'],
  external: ['axios'],
})
