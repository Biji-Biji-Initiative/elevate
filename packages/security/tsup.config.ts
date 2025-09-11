import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: {
    index: 'src/index.ts',
    constants: 'src/constants.ts',
    csrf: 'src/csrf.ts',
    'rate-limiter': 'src/rate-limiter.ts',
    csp: 'src/csp.ts',
    'security-middleware': 'src/security-middleware.ts',
    'csp-hooks': 'src/csp-hooks.tsx',
    sanitizer: 'src/sanitizer.ts',
  },
  external: ['@upstash/redis', 'crypto'],
})
