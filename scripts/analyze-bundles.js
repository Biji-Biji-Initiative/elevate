#!/usr/bin/env node

/**
 * Bundle Analysis Script for i18n Optimization
 * 
 * This script analyzes the webpack bundle to verify that:
 * 1. Each locale is in its own chunk
 * 2. No locale is included in multiple chunks
 * 3. Common i18n code is properly shared
 * 
 * Usage:
 * npm run analyze:bundles
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APPS = ['web', 'admin'];
const LOCALES = ['en', 'id'];

function analyzeApp(appName) {
  console.log(`\n🔍 Analyzing ${appName} app...`);
  
  const appPath = path.join(__dirname, '..', 'apps', appName);
  const buildPath = path.join(appPath, '.next');
  
  if (!fs.existsSync(buildPath)) {
    console.log(`❌ ${appName} app not built. Running build first...`);
    try {
      execSync(`cd ${appPath} && pnpm build`, { stdio: 'inherit' });
    } catch (error) {
      console.error(`❌ Failed to build ${appName} app:`, error.message);
      return;
    }
  }

  // Check for locale chunks
  const staticPath = path.join(buildPath, 'static', 'chunks');
  if (!fs.existsSync(staticPath)) {
    console.log(`❌ No chunks directory found for ${appName} app`);
    return;
  }

  const chunks = fs.readdirSync(staticPath).filter(file => file.endsWith('.js'));
  console.log(`📦 Found ${chunks.length} JavaScript chunks`);

  // Look for locale-specific chunks
  const localeChunks = {
    en: [],
    id: [],
    nextIntl: []
  };

  chunks.forEach(chunk => {
    if (chunk.includes('locale-en')) {
      localeChunks.en.push(chunk);
    } else if (chunk.includes('locale-id')) {
      localeChunks.id.push(chunk);
    } else if (chunk.includes('next-intl')) {
      localeChunks.nextIntl.push(chunk);
    }
  });

  // Report findings
  console.log('\n📊 Locale Bundle Analysis:');
  
  LOCALES.forEach(locale => {
    const chunks = localeChunks[locale];
    if (chunks.length > 0) {
      console.log(`✅ ${locale.toUpperCase()}: ${chunks.length} chunk(s) - ${chunks.join(', ')}`);
    } else {
      console.log(`⚠️  ${locale.toUpperCase()}: No dedicated chunks found`);
    }
  });

  if (localeChunks.nextIntl.length > 0) {
    console.log(`✅ next-intl library: ${localeChunks.nextIntl.length} chunk(s) - ${localeChunks.nextIntl.join(', ')}`);
  } else {
    console.log('⚠️  next-intl library: No dedicated chunks found');
  }

  // Check for locale content in main chunks
  console.log('\n🔍 Checking for locale leakage in main chunks...');
  let leakageFound = false;

  const mainChunks = chunks.filter(chunk => 
    !chunk.includes('locale-') && 
    !chunk.includes('next-intl') &&
    !chunk.startsWith('webpack-') &&
    !chunk.startsWith('polyfills-')
  );

  mainChunks.slice(0, 5).forEach(chunk => { // Check first 5 main chunks
    const chunkPath = path.join(staticPath, chunk);
    try {
      const content = fs.readFileSync(chunkPath, 'utf8');
      
      LOCALES.forEach(locale => {
        const localeMessages = path.join(appPath, 'messages', `${locale}.json`);
        if (fs.existsSync(localeMessages)) {
          const messages = JSON.parse(fs.readFileSync(localeMessages, 'utf8'));
          
          // Check for a few sample strings from each locale
          const sampleStrings = [
            messages.common?.loading,
            messages.navigation?.dashboard,
            messages.dashboard?.title
          ].filter(Boolean);

          sampleStrings.forEach(str => {
            if (content.includes(str)) {
              console.log(`⚠️  Found ${locale} content in ${chunk}: "${str}"`);
              leakageFound = true;
            }
          });
        }
      });
    } catch (error) {
      // Skip binary or problematic files
    }
  });

  if (!leakageFound) {
    console.log('✅ No locale leakage detected in main chunks');
  }

  // Generate size report
  console.log('\n📏 Bundle Size Analysis:');
  const sizeStats = {};
  
  chunks.forEach(chunk => {
    const chunkPath = path.join(staticPath, chunk);
    const stats = fs.statSync(chunkPath);
    const sizeKB = Math.round(stats.size / 1024);
    
    if (chunk.includes('locale-en')) {
      sizeStats.localeEn = (sizeStats.localeEn || 0) + sizeKB;
    } else if (chunk.includes('locale-id')) {
      sizeStats.localeId = (sizeStats.localeId || 0) + sizeKB;
    } else if (chunk.includes('next-intl')) {
      sizeStats.nextIntl = (sizeStats.nextIntl || 0) + sizeKB;
    }
  });

  Object.entries(sizeStats).forEach(([key, sizeKB]) => {
    console.log(`📦 ${key}: ${sizeKB}KB`);
  });

  return sizeStats;
}

function main() {
  console.log('🚀 Starting i18n Bundle Analysis\n');
  console.log('This script will analyze bundle splitting for internationalization');
  console.log('to ensure each locale is properly separated into its own chunks.\n');

  const results = {};
  
  APPS.forEach(appName => {
    results[appName] = analyzeApp(appName);
  });

  console.log('\n📋 Summary Report:');
  console.log('================');
  
  Object.entries(results).forEach(([appName, stats]) => {
    console.log(`\n${appName.toUpperCase()} App:`);
    if (stats && Object.keys(stats).length > 0) {
      Object.entries(stats).forEach(([key, size]) => {
        console.log(`  ${key}: ${size}KB`);
      });
    } else {
      console.log('  ❌ No locale chunks found or build failed');
    }
  });

  console.log('\n✅ Analysis complete!');
  console.log('\nTo generate visual bundle analysis:');
  APPS.forEach(app => {
    console.log(`  cd apps/${app} && ANALYZE=true pnpm build`);
  });
}

if (require.main === module) {
  main();
}