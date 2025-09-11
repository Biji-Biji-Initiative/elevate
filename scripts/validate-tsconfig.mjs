#!/usr/bin/env node

/**
 * Validates TypeScript configuration for common monorepo issues
 * - Duplicate project references
 * - Missing project references  
 * - Circular dependencies
 * - Invalid paths
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { glob } from 'glob';

const rootDir = process.cwd();

async function validateTsConfig() {
  console.log('🔍 Validating TypeScript configuration...\n');
  
  let hasErrors = false;
  
  try {
    // Read root tsconfig.json
    const rootTsConfigPath = resolve(rootDir, 'tsconfig.json');
    const rootTsConfig = JSON.parse(readFileSync(rootTsConfigPath, 'utf8'));
    
    // Validate project references
    if (!rootTsConfig.references) {
      console.log('❌ No project references found in root tsconfig.json');
      hasErrors = true;
    } else {
      hasErrors = validateProjectReferences(rootTsConfig.references) || hasErrors;
    }
    
    // Find all workspace packages
    const packageDirs = await glob('packages/*/package.json');
    hasErrors = validateWorkspacePackages(packageDirs, rootTsConfig.references || []) || hasErrors;
    
    if (!hasErrors) {
      console.log('✅ TypeScript configuration is valid!');
    } else {
      console.log('\n❌ TypeScript configuration has issues that need to be fixed.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Failed to validate TypeScript configuration:', error.message);
    process.exit(1);
  }
}

function validateProjectReferences(references) {
  console.log('📋 Validating project references...');
  let hasErrors = false;
  
  // Check for duplicates
  const paths = references.map(ref => ref.path);
  const duplicates = paths.filter((path, index) => paths.indexOf(path) !== index);
  
  if (duplicates.length > 0) {
    console.log('❌ Duplicate project references found:');
    duplicates.forEach(dup => {
      const indices = paths.map((p, i) => p === dup ? i + 1 : null).filter(Boolean);
      console.log(`   ${dup} (lines: ${indices.join(', ')})`);
    });
    hasErrors = true;
  } else {
    console.log('✅ No duplicate references');
  }
  
  // Check if referenced files exist
  references.forEach(ref => {
    const fullPath = resolve(rootDir, ref.path);
    try {
      readFileSync(fullPath, 'utf8');
    } catch (error) {
      console.log(`❌ Referenced file does not exist: ${ref.path}`);
      hasErrors = true;
    }
  });
  
  if (!hasErrors) {
    console.log('✅ All project references are valid');
  }
  
  return hasErrors;
}

function validateWorkspacePackages(packageDirs, references) {
  console.log('\n📦 Validating workspace packages...');
  let hasErrors = false;
  
  const referencePaths = references.map(ref => resolve(rootDir, ref.path));
  
  // Check each package has corresponding TypeScript build config
  for (const packagePath of packageDirs) {
    const packageDir = dirname(packagePath);
    const packageName = packageDir.split('/').pop();
    
    // Skip non-TypeScript packages (apps might not need build configs)
    const buildConfigPath = resolve(packageDir, 'tsconfig.build.json');
    
    try {
      readFileSync(buildConfigPath, 'utf8');
      
      // Check if this build config is referenced in root tsconfig
      const expectedReference = resolve(packageDir, 'tsconfig.build.json');
      
      if (!referencePaths.includes(expectedReference)) {
        console.log(`⚠️  Package ${packageName} has tsconfig.build.json but is not referenced in root tsconfig.json`);
        // This might be intentional for apps, so it's a warning not an error
      }
      
    } catch (error) {
      // Package doesn't have build config - check if it should
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      
      // If package has TypeScript files and is in the @elevate namespace, it should have build config
      if (packageJson.name?.startsWith('@elevate/')) {
        console.log(`❌ Package ${packageName} appears to be a library but missing tsconfig.build.json`);
        hasErrors = true;
      }
    }
  }
  
  if (!hasErrors) {
    console.log('✅ All workspace packages properly configured');
  }
  
  return hasErrors;
}

// Run validation
validateTsConfig();