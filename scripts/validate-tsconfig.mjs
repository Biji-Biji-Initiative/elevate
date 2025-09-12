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
      hasErrors = validateCircularDependencies(rootTsConfig.references) || hasErrors;
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
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
        if (packageJson.name?.startsWith('@elevate/')) {
          console.log(`❌ Library ${packageName} has tsconfig.build.json but is not referenced in root tsconfig.json`);
          hasErrors = true;
        } else {
          console.log(`⚠️  Package ${packageName} has tsconfig.build.json but is not referenced in root tsconfig.json`);
        }
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

function validateCircularDependencies(references) {
  console.log('\n🔄 Checking for circular dependencies...');
  let hasErrors = false;
  
  try {
    // Build dependency graph
    const graph = buildDependencyGraph(references);
    const cycles = findCircularDependencies(graph);
    
    if (cycles.length > 0) {
      console.log('❌ Circular dependencies found:');
      cycles.forEach((cycle, index) => {
        console.log(`   Cycle ${index + 1}: ${cycle.join(' → ')}`);
      });
      hasErrors = true;
    } else {
      console.log('✅ No circular dependencies found');
    }
  } catch (error) {
    console.log(`❌ Failed to check circular dependencies: ${error.message}`);
    hasErrors = true;
  }
  
  return hasErrors;
}

function buildDependencyGraph(references) {
  const graph = new Map();
  
  // Initialize nodes
  references.forEach(ref => {
    const configPath = resolve(rootDir, ref.path);
    graph.set(configPath, new Set());
  });
  
  // Build edges by reading each tsconfig and its references
  references.forEach(ref => {
    const configPath = resolve(rootDir, ref.path);
    
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      const configDir = dirname(configPath);
      
      if (config.references) {
        config.references.forEach(childRef => {
          const childPath = resolve(configDir, childRef.path);
          if (graph.has(childPath)) {
            graph.get(configPath).add(childPath);
          }
        });
      }
    } catch (error) {
      // Skip files that can't be read
    }
  });
  
  return graph;
}

function findCircularDependencies(graph) {
  const cycles = [];
  const visited = new Set();
  const recursionStack = new Set();
  const currentPath = [];
  
  function dfs(node) {
    if (recursionStack.has(node)) {
      // Found a cycle - extract the cycle from currentPath
      const cycleStart = currentPath.indexOf(node);
      if (cycleStart !== -1) {
        const cycle = currentPath.slice(cycleStart).map(path => {
          const relativePath = path.replace(rootDir + '/', '');
          return relativePath;
        });
        cycle.push(cycle[0]); // Complete the cycle
        cycles.push(cycle);
      }
      return true;
    }
    
    if (visited.has(node)) {
      return false;
    }
    
    visited.add(node);
    recursionStack.add(node);
    currentPath.push(node);
    
    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) {
        return true;
      }
    }
    
    recursionStack.delete(node);
    currentPath.pop();
    return false;
  }
  
  // Check all nodes
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  
  return cycles;
}

// Run validation
validateTsConfig();