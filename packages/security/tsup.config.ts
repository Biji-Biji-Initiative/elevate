import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: [
    'src/index.ts',
    'src/csrf.ts',
    'src/rate-limiter.ts',
    'src/csp.ts',
    'src/security-middleware.ts',
    'src/csp-hooks.tsx',
    'src/sanitizer.ts',
  ],
  external: ['@upstash/redis', 'crypto'],
})
