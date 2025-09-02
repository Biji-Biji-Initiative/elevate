#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { openApiSpec } from './spec.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure dist directory exists
const distDir = resolve(__dirname, '../dist');
mkdirSync(distDir, { recursive: true });

// Write OpenAPI spec to JSON file
const specPath = resolve(distDir, 'openapi.json');
writeFileSync(specPath, JSON.stringify(openApiSpec, null, 2), 'utf-8');

console.log(`✅ OpenAPI specification generated: ${specPath}`);
console.log(`📊 Endpoints: ${Object.keys(openApiSpec.paths || {}).length}`);
console.log(`🔧 Components: ${Object.keys(openApiSpec.components?.schemas || {}).length} schemas`);

// Generate TypeScript client types
try {
  const { execSync } = await import('child_process');
  const clientPath = resolve(distDir, 'client.ts');
  
  execSync(`npx openapi-typescript ${specPath} -o ${clientPath}`, { 
    stdio: 'inherit',
    cwd: dirname(__dirname)
  });
  
  console.log(`🎯 TypeScript client generated: ${clientPath}`);
} catch (error) {
  console.warn('⚠️  Failed to generate TypeScript client:', error);
  console.warn('   Run manually: npx openapi-typescript dist/openapi.json -o dist/client.ts');
}

console.log('\n🚀 OpenAPI documentation generated successfully!');
console.log('   View at: http://localhost:3000/api/docs (once Swagger UI is set up)');