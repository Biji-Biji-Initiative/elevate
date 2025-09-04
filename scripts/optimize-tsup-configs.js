#!/usr/bin/env node

/**
 * Script to optimize tsup configurations for better tree-shaking
 * Applies consistent optimization settings across all packages
 */

const fs = require('fs').promises;
const path = require('path');

const glob = require('glob');

const TSUP_OPTIMIZATIONS = `
  treeshake: true,
  splitting: false, // Better for libraries
  minify: false, // Leave minification to consumers
  target: 'es2022',
  platform: 'neutral',
  preserveModules: true, // Better tree-shaking
  external: [
    // External peer dependencies for better tree-shaking
    'react',
    'react-dom',
    'react/jsx-runtime',
    'next',
    'next/link',
    'next/navigation',
    'next/image',
    '@sentry/nextjs',
    /^@radix-ui\\//,
    'lucide-react',
    'class-variance-authority',
    'tailwind-merge',
    'clsx',
    'react-hook-form',
    /^@elevate\\//
  ],`;

async function optimizeTsupConfig(configPath) {
  try {
    const content = await fs.readFile(configPath, 'utf8');
    
    // Check if already optimized
    if (content.includes('treeshake: true') && content.includes('preserveModules: true')) {
      console.log(`✅ ${path.basename(path.dirname(configPath))}: Already optimized`);
      return;
    }
    
    // Find the defineConfig block and inject optimizations
    const optimized = content.replace(
      /(export default defineConfig\(\{[^}]*)(}\))/s,
      (match, opening, closing) => {
        // Remove the closing brace and add optimizations
        const withoutClosing = opening.replace(/,$/, '');
        return `${withoutClosing},${TSUP_OPTIMIZATIONS}\n${closing}`;
      }
    );
    
    if (optimized !== content) {
      await fs.writeFile(configPath, optimized);
      console.log(`🔧 ${path.basename(path.dirname(configPath))}: Updated tsup config`);
    } else {
      console.log(`⚠️ ${path.basename(path.dirname(configPath))}: Could not update automatically`);
    }
  } catch (error) {
    console.error(`❌ ${configPath}: Failed to update - ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Optimizing tsup configurations for better tree-shaking...\n');
  
  // Find all tsup config files
  const configFiles = glob.sync('packages/*/tsup.config.ts', { 
    cwd: path.join(__dirname, '..') 
  });
  
  if (configFiles.length === 0) {
    console.log('❌ No tsup config files found');
    return;
  }
  
  console.log(`Found ${configFiles.length} tsup config files:\n`);
  
  // Process each config file
  for (const configFile of configFiles) {
    const fullPath = path.join(__dirname, '..', configFile);
    await optimizeTsupConfig(fullPath);
  }
  
  console.log('\n✅ Tsup optimization complete!');
  console.log('\nNext steps:');
  console.log('- Run `pnpm build` to test the optimized builds');
  console.log('- Use `pnpm analyze:size` to verify tree-shaking improvements');
  console.log('- Review any packages that could not be updated automatically');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { optimizeTsupConfig };