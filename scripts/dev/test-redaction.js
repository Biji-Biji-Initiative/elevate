/* Dev utility to verify redaction utils */
const { redactSensitiveData, redactObjectSensitiveData } = require('../../packages/types/dist/error-utils.js')
const logger = require('../utils/logger')

const testCases = [
  'API key: sk-abc123def456',
  'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'Database error at /Users/agent-g/elevate/secret.js',
  'Connection failed to postgresql://user:pass@localhost/db',
  'Error from 192.168.1.100',
  'Password=mySecretPassword123',
  'secret_token=abc123xyz789',
]

logger.info('=== Testing String Redaction ===')
testCases.forEach((test, i) => {
  logger.info(`Test ${i + 1}:`)
  logger.info(`Original: ${test}`)
  logger.info(`Redacted: ${redactSensitiveData(test)}`)
  logger.info('---')
})

const testObject = {
  message: 'API error with key=sk-12345',
  details: {
    path: '/Users/agent-g/secret/config.json',
    authorization: 'Bearer token123',
    password: 'supersecret',
    normal_field: 'this should remain',
  },
  stack: 'Error at /home/user/app.js:10:5',
}

logger.info('\n=== Testing Object Redaction ===')
logger.info('Original Object:')
logger.info(JSON.stringify(testObject, null, 2))
logger.info('\nRedacted Object:')
logger.info(JSON.stringify(redactObjectSensitiveData(testObject), null, 2))
