#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all package tsconfig.json files
const packageTsconfigs = glob.sync('packages/*/tsconfig.json', {
  absolute: true,
  cwd: path.join(__dirname, '..')
});

console.log(`Found ${packageTsconfigs.length} package tsconfig.json files to fix`);

// Fix each tsconfig.json to add composite: true
packageTsconfigs.forEach(tsconfigPath => {
  try {
    const content = fs.readFileSync(tsconfigPath, 'utf8');
    const config = JSON.parse(content);
    
    // Add composite: true to compilerOptions
    if (!config.compilerOptions) {
      config.compilerOptions = {};
    }
    
    if (!config.compilerOptions.composite) {
      config.compilerOptions.composite = true;
      
      // Write back with proper formatting
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify(config, null, 2) + '\n',
        'utf8'
      );
      
      console.log(`✅ Fixed: ${path.relative(path.join(__dirname, '..'), tsconfigPath)}`);
    } else {
      console.log(`⏭️  Already has composite: ${path.relative(path.join(__dirname, '..'), tsconfigPath)}`);
    }
  } catch (error) {
    console.error(`❌ Error fixing ${tsconfigPath}:`, error.message);
  }
});

console.log('\nDone! All package tsconfig.json files should now have composite: true');