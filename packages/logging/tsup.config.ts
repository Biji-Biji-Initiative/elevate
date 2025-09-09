import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: {
    index: 'src/index.ts',
    client: 'src/client.ts',
    server: 'src/server.ts',
    'safe-server': 'src/safe-server.ts',
  },
  external: ['pino', 'pino-pretty', '@sentry/node'],
})
