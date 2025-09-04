import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: ['src/index.ts'],
  external: ['@react-email/components', '@react-email/render', 'resend'],
})
