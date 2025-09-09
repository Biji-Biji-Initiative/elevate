// Lightweight Pino logger for Node scripts (ESM)
import pino from 'pino'

export const logger = pino(
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

export default logger

