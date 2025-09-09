// Lightweight Pino logger for Node scripts (CJS)
// Pretty prints in non-production to keep DX friendly
const pino = require('pino')

const logger = pino(
  process.env.NODE_ENV === 'production'
    ? { level: process.env.LOG_LEVEL || 'info' }
    : {
        level: process.env.LOG_LEVEL || 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      },
)

module.exports = logger

