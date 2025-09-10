import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: [
    'src/index.ts',
    'src/schemas.ts',
    'src/activity-canon.ts',
    'src/query-schemas.ts',
    'src/admin-schemas.ts',
    'src/admin-api-types.ts',
    'src/api-types.ts',
    'src/dto-mappers.ts',
    'src/ui-types.ts',
    'src/common.ts',
    'src/submission-payloads.ts',
    'src/webhooks.ts',
    'src/errors.ts',
    'src/canonical-urls.ts',
    'src/http.ts',
  ],
  external: ['zod'],
})
