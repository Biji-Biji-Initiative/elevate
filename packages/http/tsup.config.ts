import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: {
    index: 'src/index.ts',
    'error-utils': 'src/error-utils.ts',
    middleware: 'src/middleware.ts',
    'test-utils': 'src/test-utils.ts',
  },
  external: ['zod'],
})
