import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: {
    index: 'src/index.ts',
    actions: 'src/actions.ts',
    utils: 'src/utils.ts',
  },
  external: ['zod'],
})
