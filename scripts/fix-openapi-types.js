#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the SDK file
const sdkPath = path.join(__dirname, '../packages/openapi/src/sdk.ts');
let content = fs.readFileSync(sdkPath, 'utf8');

// Replace all instances of ['requestBody']['content'] with NonNullable wrapper
content = content.replace(
  /paths\[([^\]]+)\]\[([^\]]+)\]\['requestBody'\]\['content'\]/g,
  "NonNullable<paths[$1][$2]['requestBody']>['content']"
);

// Write back
fs.writeFileSync(sdkPath, content, 'utf8');

console.log('✅ Fixed OpenAPI SDK requestBody types');