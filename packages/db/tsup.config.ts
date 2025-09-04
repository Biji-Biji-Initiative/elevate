import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: ['src/index.ts', 'src/client.ts', 'src/utils.ts'],
  external: ['@prisma/client'],
})
