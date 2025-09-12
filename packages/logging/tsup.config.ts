import baseTsup from '../../tsup.base.mjs'

export default baseTsup({
  entry: {
    index: 'src/index.ts',
    client: 'src/client.ts',
    server: 'src/server.ts',
    'safe-server': 'src/safe-server.ts',
    metrics: 'src/metrics.ts',
    'slo-monitor': 'src/slo-monitor.ts',
    'request-logger': 'src/request-logger.ts',
  },
  external: ['pino', 'pino-pretty', '@sentry/node'],
})
