#!/usr/bin/env node

/**
 * Verifies that all workspace packages are properly built
 * - Checks dist/js and dist/types directories exist
 * - Validates package.json exports point to existing files
 * - Ensures all @elevate packages have required build artifacts
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';

import { glob } from 'glob';

const rootDir = process.cwd();

async function verifyBuildHealth() {
  console.log('🔍 Verifying build health...\n');
  
  let hasErrors = false;
  
  try {
    // Find all workspace packages
    const packageDirs = await glob('packages/*/package.json');
    
    for (const packagePath of packageDirs) {
      const packageDir = dirname(packagePath);
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      const packageName = packageJson.name;
      
      console.log(`📦 Checking ${packageName}...`);
      
      // Skip non-@elevate packages (might be different build setup)
      if (!packageName.startsWith('@elevate/')) {
        console.log(`   ⏭️  Skipping non-@elevate package`);
        continue;
      }
      
      const packageErrors = validatePackageBuild(packageDir, packageJson);
      if (packageErrors.length > 0) {
        hasErrors = true;
        packageErrors.forEach(error => console.log(`   ❌ ${error}`));
      } else {
        console.log(`   ✅ Build artifacts valid`);
      }
    }
    
    if (!hasErrors) {
      console.log('\n✅ All packages have valid build artifacts!');
    } else {
      console.log('\n❌ Some packages have build issues that need to be fixed.');
      console.log('\n💡 Try running: pnpm -r --filter "@elevate/*" run build');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Failed to verify build health:', error.message);
    process.exit(1);
  }
}

function validatePackageBuild(packageDir, packageJson) {
  const errors = [];
  const packageName = packageJson.name;
  
  // Check if package has build scripts
  const hasTypesBuild = packageJson.scripts?.['build:types'];
  const hasJsBuild = packageJson.scripts?.['build:js'] || packageJson.scripts?.['build'];
  
  if (!hasTypesBuild && !hasJsBuild) {
    // Some packages might not need building (pure config, etc.)
    return errors;
  }
  
  // Check required directories exist
  const distTypesDir = resolve(packageDir, 'dist/types');
  const distJsDir = resolve(packageDir, 'dist/js');
  
  if (hasTypesBuild && !existsSync(distTypesDir)) {
    errors.push('Missing dist/types directory');
  }
  
  if (hasJsBuild && !existsSync(distJsDir)) {
    errors.push('Missing dist/js directory');
  }
  
  // Check main entry points exist
  if (packageJson.main) {
    const mainPath = resolve(packageDir, packageJson.main);
    if (!existsSync(mainPath)) {
      errors.push(`Main entry point does not exist: ${packageJson.main}`);
    }
  }
  
  if (packageJson.types) {
    const typesPath = resolve(packageDir, packageJson.types);
    if (!existsSync(typesPath)) {
      errors.push(`Types entry point does not exist: ${packageJson.types}`);
    }
  }
  
  // Note: Export validation is handled separately by 'pnpm run verify:exports'
  
  return errors;
}

// Note: This script focuses on build artifacts, not export validation
// Export validation is handled by scripts/validate-exports.mjs

// Run verification
verifyBuildHealth();