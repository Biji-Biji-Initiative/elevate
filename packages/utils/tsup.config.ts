import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: ['src/index.ts', 'src/errors.ts'],
})
