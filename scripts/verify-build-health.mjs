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
  let warnings = [];
  
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
  
  // Check package.json exports
  if (packageJson.exports) {
    const exportErrors = validateExports(packageDir, packageJson.exports);
    errors.push(...exportErrors);
  }
  
  return errors;
}

function validateExports(packageDir, exports) {
  const errors = [];
  
  function checkExportPath(exportPath, context) {
    if (typeof exportPath === 'string') {
      // Skip special exports like "./package.json"
      if (exportPath === './package.json' || exportPath.startsWith('./') === false) {
        return;
      }
      
      const fullPath = resolve(packageDir, exportPath);
      if (!existsSync(fullPath)) {
        errors.push(`Export "${context}" points to non-existent file: ${exportPath}`);
      }
    } else if (typeof exportPath === 'object') {
      // Handle conditional exports like { "import": "./dist/js/index.js", "types": "./dist/types/index.d.ts" }
      Object.entries(exportPath).forEach(([condition, path]) => {
        checkExportPath(path, `${context} (${condition})`);
      });
    }
  }
  
  // Handle different export formats
  if (typeof exports === 'string') {
    checkExportPath(exports, 'main');
  } else if (Array.isArray(exports)) {
    exports.forEach((exp, index) => checkExportPath(exp, `export[${index}]`));
  } else if (typeof exports === 'object') {
    Object.entries(exports).forEach(([key, value]) => {
      checkExportPath(value, key);
    });
  }
  
  return errors;
}

function checkFileSize(filePath) {
  try {
    const stats = statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

// Run verification
verifyBuildHealth();