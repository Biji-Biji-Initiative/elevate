#!/usr/bin/env node
/**
 * Boundary enforcement script for Prisma-first architecture
 * Checks that architectural boundaries are maintained across the monorepo
 */

const fs = require('fs');
const path = require('path');

const glob = require('glob');

const violations = [];

/**
 * Check for direct @prisma/client imports outside packages/db
 */
function checkPrismaImports() {
  const patterns = [
    'apps/**/*.{ts,tsx}',
    'packages/!(db)/**/*.{ts,tsx}'
  ];

  patterns.forEach(pattern => {
    const files = glob.sync(pattern, { cwd: __dirname + '/..', ignore: ['**/node_modules/**','**/dist/**'] });
    
    files.forEach(filePath => {
      const fullPath = path.join(__dirname, '..', filePath);
      if (!fs.existsSync(fullPath)) return;
      
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Skip app route handlers for now (handled by migration plan)
      if (filePath.includes('apps/web/app/api/') || filePath.includes('apps/admin/app/api/')) {
        return
      }

      // Check for direct @prisma/client imports
      if (content.includes('@prisma/client')) {
        violations.push({
          file: filePath,
          issue: 'Direct @prisma/client import detected',
          rule: 'Use @elevate/db instead of direct @prisma/client imports',
          severity: 'error'
        });
      }
      
      // Check for prisma client instantiation
      if (content.match(/new\s+PrismaClient/)) {
        violations.push({
          file: filePath,
          issue: 'Direct PrismaClient instantiation detected',
          rule: 'Use shared client from @elevate/db',
          severity: 'error'
        });
      }
    });
  });
}

/**
 * Check API routes for DTO usage patterns
 */
function checkAPIRoutes() {
  const apiFiles = glob.sync('apps/**/api/**/*.{ts,tsx}', { cwd: __dirname + '/..' });
  
  apiFiles.forEach(filePath => {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) return;
    
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check for direct payload access without transformation
    const payloadRegex = /\.payload(?!\s*\??\.\s*(transform|map))/g;
    const matches = content.match(payloadRegex);
    
    if (matches && matches.length > 2) { // Allow some direct access
      violations.push({
        file: filePath,
        issue: 'Frequent direct payload access without DTO transformation',
        rule: 'Consider using DTO transformations for payload data',
        severity: 'warning'
      });
    }
    
    // Check for snake_case usage in responses (should be camelCase)
    const snakeCaseResponse = /response.*['"]\w+_\w+['"]|return.*['"]\w+_\w+['"]/.test(content);
    if (snakeCaseResponse) {
      violations.push({
        file: filePath,
        issue: 'snake_case detected in API response',
        rule: 'API responses should use camelCase via DTO transformations',
        severity: 'warning'
      });
    }
  });
}

/**
 * Check that schema field names match expected patterns
 */
function checkSchemaAlignment() {
  const schemaPath = path.join(__dirname, '..', 'packages', 'types', 'src', 'schemas.ts');
  
  if (!fs.existsSync(schemaPath)) {
    violations.push({
      file: 'packages/types/src/schemas.ts',
      issue: 'Schema file not found',
      rule: 'Zod schemas should exist and use snake_case for DB storage',
      severity: 'error'
    });
    return;
  }
  
  const content = fs.readFileSync(schemaPath, 'utf8');
  
  // Check that AmplifySchema uses snake_case field names
  const amplifyMatch = content.match(/AmplifySchema = z\.object\(\{([^}]+)\}/s);
  if (amplifyMatch) {
    const amplifyContent = amplifyMatch[1];
    
    if (!amplifyContent.includes('peers_trained') || !amplifyContent.includes('students_trained')) {
      violations.push({
        file: 'packages/types/src/schemas.ts',
        issue: 'AmplifySchema should use snake_case field names (peers_trained, students_trained)',
        rule: 'DB storage schemas should use snake_case matching Prisma schema',
        severity: 'error'
      });
    }
  }
}

// Run all checks
checkPrismaImports();
checkAPIRoutes();
checkSchemaAlignment();

// Report results
if (violations.length === 0) {
  console.log('✅ All architectural boundaries are properly maintained!');
  process.exit(0);
} else {
  console.log('❌ Architectural boundary violations detected:\n');
  
  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');
  
  if (errors.length > 0) {
    console.log('🔴 ERRORS:');
    errors.forEach(violation => {
      console.log(`  ${violation.file}:`);
      console.log(`    ${violation.issue}`);
      console.log(`    Rule: ${violation.rule}\n`);
    });
  }
  
  if (warnings.length > 0) {
    console.log('🟡 WARNINGS:');
    warnings.forEach(violation => {
      console.log(`  ${violation.file}:`);
      console.log(`    ${violation.issue}`);
      console.log(`    Rule: ${violation.rule}\n`);
    });
  }
  
  console.log(`Total: ${errors.length} error(s), ${warnings.length} warning(s)`);
  
  // Exit with error code if there are errors
  process.exit(errors.length > 0 ? 1 : 0);
}
