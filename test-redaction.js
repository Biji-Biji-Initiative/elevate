// Quick test to verify redaction functionality
const { redactSensitiveData, redactObjectSensitiveData } = require('./packages/types/dist/error-utils.js');

// Test cases
const testCases = [
  "API key: sk-abc123def456",
  "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  "Database error at /Users/agent-g/elevate/secret.js",
  "Connection failed to postgresql://user:pass@localhost/db",
  "Error from 192.168.1.100",
  "Password=mySecretPassword123",
  "secret_token=abc123xyz789",
];

console.log('=== Testing String Redaction ===');
testCases.forEach((test, i) => {
  console.log(`Test ${i + 1}:`);
  console.log(`Original: ${test}`);
  console.log(`Redacted: ${redactSensitiveData(test)}`);
  console.log('---');
});

const testObject = {
  message: "API error with key=sk-12345",
  details: {
    path: "/Users/agent-g/secret/config.json",
    authorization: "Bearer token123",
    password: "supersecret",
    normal_field: "this should remain"
  },
  stack: "Error at /home/user/app.js:10:5"
};

console.log('\n=== Testing Object Redaction ===');
console.log('Original Object:');
console.log(JSON.stringify(testObject, null, 2));
console.log('\nRedacted Object:');
console.log(JSON.stringify(redactObjectSensitiveData(testObject), null, 2));