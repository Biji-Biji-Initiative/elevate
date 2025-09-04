import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: ['src/index.ts'],
  external: ['@supabase/supabase-js', 'crypto'],
})
