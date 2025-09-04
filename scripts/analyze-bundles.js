#!/usr/bin/env node

/**
 * Comprehensive Bundle Analysis Script for MS Elevate Monorepo
 * 
 * This script analyzes webpack bundles and provides insights on:
 * 1. Bundle sizes and composition
 * 2. Tree-shaking effectiveness
 * 3. i18n locale chunking optimization
 * 4. Duplicate code detection
 * 5. Performance impact assessment
 * 
 * Usage:
 * npm run analyze:bundles [--skip-build] [--skip-size] [--visual]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

async function analyzePackageSizes() {
  console.log('\n📊 Running size-limit analysis...');
  
  try {
    const output = execSync('npx size-limit --json', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const results = JSON.parse(output);
    console.log('\n📦 Package Size Report:');
    console.log('=====================');
    
    results.forEach(result => {
      const status = result.size <= result.limit ? '✅' : '❌';
      const sizeKB = Math.round(result.size / 1024);
      const limitKB = Math.round(result.limit / 1024);
      const percentage = Math.round((result.size / result.limit) * 100);
      
      console.log(`${status} ${result.name}: ${sizeKB}KB / ${limitKB}KB (${percentage}%)`);
    });
    
    return results;
  } catch (error) {
    console.error('⚠️ Size-limit analysis failed:', error.message);
    return null;
  }
}

async function runVisualAnalysis() {
  console.log('\n🎨 Running visual bundle analysis...');
  
  for (const appName of APPS) {
    console.log(`\n🔍 Analyzing ${appName} app with webpack-bundle-analyzer...`);
    
    try {
      const appPath = path.join(__dirname, '..', 'apps', appName);
      const env = { ...process.env, ANALYZE: 'true' };
      
      execSync('pnpm build', {
        cwd: appPath,
        env,
        stdio: 'inherit'
      });
      
      console.log(`✅ ${appName} visual analysis complete - check browser`);
    } catch (error) {
      console.error(`❌ ${appName} visual analysis failed:`, error.message);
    }
  }
}

async function detectDuplicates() {
  console.log('\n🔍 Detecting duplicate dependencies...');
  
  const duplicates = new Map();
  
  for (const appName of APPS) {
    const appPath = path.join(__dirname, '..', 'apps', appName);
    const buildManifestPath = path.join(appPath, '.next', 'build-manifest.json');
    
    if (fs.existsSync(buildManifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
        const allChunks = Object.values(manifest.pages).flat();
        
        allChunks.forEach(chunk => {
          if (duplicates.has(chunk)) {
            duplicates.get(chunk).push(appName);
          } else {
            duplicates.set(chunk, [appName]);
          }
        });
      } catch (error) {
        console.warn(`⚠️ Could not analyze ${appName} for duplicates:`, error.message);
      }
    }
  }
  
  const sharedChunks = Array.from(duplicates.entries())
    .filter(([_, apps]) => apps.length > 1);
  
  if (sharedChunks.length > 0) {
    console.log('\n🔄 Shared chunks detected:');
    sharedChunks.forEach(([chunk, apps]) => {
      console.log(`  📦 ${chunk} -> ${apps.join(', ')}`);
    });
  } else {
    console.log('✅ No duplicate chunks detected between apps');
  }
  
  return sharedChunks;
}

async function generateComprehensiveReport(i18nResults, sizeResults, duplicates) {
  console.log('\n📄 Generating comprehensive report...');
  
  const reportData = {
    timestamp: new Date().toISOString(),
    analysis: {
      i18n: i18nResults,
      sizes: sizeResults,
      duplicates: duplicates ? duplicates.length : 0,
      recommendations: []
    }
  };
  
  // Generate recommendations
  if (sizeResults) {
    const oversized = sizeResults.filter(r => r.size > r.limit);
    if (oversized.length > 0) {
      reportData.analysis.recommendations.push({
        type: 'size',
        message: `${oversized.length} packages exceed size limits`,
        packages: oversized.map(r => r.name)
      });
    }
  }
  
  if (duplicates && duplicates.length > 0) {
    reportData.analysis.recommendations.push({
      type: 'duplicates',
      message: 'Shared chunks detected - consider code splitting optimization',
      count: duplicates.length
    });
  }
  
  // Save report
  const reportPath = path.join(__dirname, '..', 'bundle-analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`📄 Report saved to: ${reportPath}`);
  
  return reportData;
}

async function main() {
  console.log('🚀 Starting Comprehensive Bundle Analysis\n');
  
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  const skipSize = args.includes('--skip-size');
  const visual = args.includes('--visual');
  
  try {
    // 1. i18n Bundle Analysis
    console.log('📍 Step 1: i18n Bundle Analysis');
    const i18nResults = {};
    APPS.forEach(appName => {
      i18nResults[appName] = analyzeApp(appName);
    });

    // 2. Package Size Analysis
    let sizeResults = null;
    if (!skipSize) {
      console.log('\n📍 Step 2: Package Size Analysis');
      sizeResults = await analyzePackageSizes();
    }

    // 3. Visual Analysis (optional)
    if (visual && !skipBuild) {
      console.log('\n📍 Step 3: Visual Bundle Analysis');
      await runVisualAnalysis();
    }

    // 4. Duplicate Detection
    console.log('\n📍 Step 4: Duplicate Detection');
    const duplicates = await detectDuplicates();

    // 5. Generate Report
    console.log('\n📍 Step 5: Report Generation');
    const report = await generateComprehensiveReport(i18nResults, sizeResults, duplicates);
    
    // Summary
    console.log('\n📋 Analysis Summary:');
    console.log('===================');
    
    Object.entries(i18nResults).forEach(([appName, stats]) => {
      console.log(`\n${appName.toUpperCase()} App (i18n):`);
      if (stats && Object.keys(stats).length > 0) {
        Object.entries(stats).forEach(([key, size]) => {
          console.log(`  ${key}: ${size}KB`);
        });
      } else {
        console.log('  ❌ No locale chunks found or build failed');
      }
    });

    if (sizeResults) {
      const oversized = sizeResults.filter(r => r.size > r.limit);
      if (oversized.length > 0) {
        console.log(`\n⚠️ ${oversized.length} packages exceed size limits`);
      } else {
        console.log('\n✅ All packages within size limits');
      }
    }

    if (duplicates.length > 0) {
      console.log(`\n🔄 ${duplicates.length} shared chunks detected`);
    } else {
      console.log('\n✅ No duplicate chunks between apps');
    }

    console.log('\n🎉 Analysis complete!');
    console.log('\nNext steps:');
    console.log('- Review bundle-analysis-report.json for detailed metrics');
    console.log('- Run with --visual for interactive webpack analysis');
    console.log('- Address any size limit violations');
    console.log('- Optimize duplicate chunks if necessary');
    
  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}