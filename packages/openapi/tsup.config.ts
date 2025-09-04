import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: {
    index: 'src/index.ts',
    spec: 'src/spec.ts',
    schemas: 'src/schemas.ts',
    client: 'src/client.ts',
    sdk: 'src/sdk.ts',
    examples: 'src/examples.ts',
  },
  external: ['@asteasolutions/zod-to-openapi', 'zod'],
})
