#!/usr/bin/env node

/**
 * Performance monitoring script for the MS Elevate monorepo
 * Tracks build times, bundle sizes, and performance metrics
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const PERF_LOG_FILE = path.join(__dirname, '..', 'performance-history.json');
const APPS = ['web', 'admin'];

async function measureBuildTime(appName) {
  const appPath = path.join(__dirname, '..', 'apps', appName);
  console.log(`⏱️  Measuring build time for ${appName}...`);
  
  const startTime = Date.now();
  
  try {
    execSync('pnpm build', {
      cwd: appPath,
      stdio: 'pipe', // Hide output for timing accuracy
      timeout: 300000 // 5 minute timeout
    });
    
    const buildTime = Date.now() - startTime;
    console.log(`✅ ${appName} build completed in ${(buildTime / 1000).toFixed(2)}s`);
    
    return {
      app: appName,
      buildTime,
      success: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const buildTime = Date.now() - startTime;
    console.log(`❌ ${appName} build failed after ${(buildTime / 1000).toFixed(2)}s`);
    
    return {
      app: appName,
      buildTime,
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function analyzeBundleSizes() {
  console.log('\n📦 Analyzing bundle sizes...');
  
  const sizes = {};
  
  for (const appName of APPS) {
    const appPath = path.join(__dirname, '..', 'apps', appName);
    const buildManifest = path.join(appPath, '.next', 'build-manifest.json');
    
    try {
      if (await fs.access(buildManifest).then(() => true).catch(() => false)) {
        const manifest = JSON.parse(await fs.readFile(buildManifest, 'utf8'));
        
        // Calculate total bundle size
        const staticDir = path.join(appPath, '.next', 'static', 'chunks');
        const chunks = await fs.readdir(staticDir).catch(() => []);
        
        let totalSize = 0;
        const chunkSizes = [];
        
        for (const chunk of chunks.filter(f => f.endsWith('.js'))) {
          try {
            const stats = await fs.stat(path.join(staticDir, chunk));
            totalSize += stats.size;
            chunkSizes.push({
              name: chunk,
              size: stats.size
            });
          } catch (err) {
            // Skip files that can't be read
          }
        }
        
        sizes[appName] = {
          totalSize,
          totalSizeKB: Math.round(totalSize / 1024),
          chunkCount: chunks.length,
          pageCount: Object.keys(manifest.pages).length,
          largestChunks: chunkSizes
            .sort((a, b) => b.size - a.size)
            .slice(0, 5)
            .map(c => ({ name: c.name, sizeKB: Math.round(c.size / 1024) }))
        };
        
        console.log(`  ${appName}: ${Math.round(totalSize / 1024)}KB total, ${chunks.length} chunks`);
      } else {
        console.log(`  ${appName}: No build found`);
        sizes[appName] = { error: 'No build found' };
      }
    } catch (error) {
      console.log(`  ${appName}: Analysis failed - ${error.message}`);
      sizes[appName] = { error: error.message };
    }
  }
  
  return sizes;
}

async function runSizeLimitCheck() {
  console.log('\n📏 Running size-limit checks...');
  
  try {
    const output = execSync('npx size-limit --json', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const results = JSON.parse(output);
    const violations = results.filter(r => r.size > r.limit);
    
    console.log(`  📊 ${results.length} packages checked, ${violations.length} violations`);
    
    return {
      total: results.length,
      violations: violations.length,
      results: results.map(r => ({
        name: r.name,
        size: r.size,
        limit: r.limit,
        passed: r.size <= r.limit,
        percentage: Math.round((r.size / r.limit) * 100)
      }))
    };
  } catch (error) {
    console.log(`  ❌ Size-limit check failed: ${error.message}`);
    return { error: error.message };
  }
}

async function loadPerformanceHistory() {
  try {
    const data = await fs.readFile(PERF_LOG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { buildHistory: [], sizeHistory: [], sizeLimit: [] };
  }
}

async function savePerformanceData(buildResults, bundleSizes, sizeLimitResults) {
  const history = await loadPerformanceHistory();
  
  const entry = {
    timestamp: new Date().toISOString(),
    builds: buildResults,
    bundles: bundleSizes,
    sizeLimit: sizeLimitResults
  };
  
  history.buildHistory = history.buildHistory || [];
  history.buildHistory.push(entry);
  
  // Keep only last 100 entries
  if (history.buildHistory.length > 100) {
    history.buildHistory = history.buildHistory.slice(-100);
  }
  
  await fs.writeFile(PERF_LOG_FILE, JSON.stringify(history, null, 2));
  console.log(`\n📄 Performance data saved to ${path.basename(PERF_LOG_FILE)}`);
}

async function generatePerformanceReport(buildResults, bundleSizes, sizeLimitResults) {
  const history = await loadPerformanceHistory();
  
  console.log('\n📊 Performance Report');
  console.log('====================');
  
  // Build times summary
  console.log('\n⏱️  Build Times:');
  buildResults.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const time = (result.buildTime / 1000).toFixed(2);
    console.log(`  ${status} ${result.app}: ${time}s`);
  });
  
  // Bundle sizes summary
  console.log('\n📦 Bundle Sizes:');
  Object.entries(bundleSizes).forEach(([app, data]) => {
    if (data.error) {
      console.log(`  ❌ ${app}: ${data.error}`);
    } else {
      console.log(`  📊 ${app}: ${data.totalSizeKB}KB (${data.chunkCount} chunks)`);
      if (data.largestChunks.length > 0) {
        console.log(`    Largest: ${data.largestChunks[0].name} (${data.largestChunks[0].sizeKB}KB)`);
      }
    }
  });
  
  // Size limit violations
  if (sizeLimitResults && !sizeLimitResults.error) {
    console.log('\n📏 Size Limits:');
    console.log(`  📊 ${sizeLimitResults.total} packages checked`);
    if (sizeLimitResults.violations > 0) {
      console.log(`  ⚠️  ${sizeLimitResults.violations} violations found`);
    } else {
      console.log('  ✅ All packages within limits');
    }
  }
  
  // Historical comparison
  if (history.buildHistory.length > 1) {
    const previous = history.buildHistory[history.buildHistory.length - 2];
    console.log('\n📈 Compared to previous run:');
    
    buildResults.forEach(result => {
      const prevResult = previous.builds.find(b => b.app === result.app);
      if (prevResult && prevResult.success && result.success) {
        const diff = result.buildTime - prevResult.buildTime;
        const percentage = ((diff / prevResult.buildTime) * 100).toFixed(1);
        const trend = diff > 0 ? '📈' : diff < 0 ? '📉' : '➡️';
        console.log(`  ${trend} ${result.app}: ${diff > 0 ? '+' : ''}${(diff / 1000).toFixed(2)}s (${percentage}%)`);
      }
    });
  }
}

async function main() {
  console.log('🚀 Starting performance monitoring...\n');
  
  const startTime = Date.now();
  
  try {
    // 1. Measure build times
    console.log('📍 Step 1: Build Performance');
    const buildResults = [];
    for (const appName of APPS) {
      const result = await measureBuildTime(appName);
      buildResults.push(result);
    }
    
    // 2. Analyze bundle sizes
    console.log('\n📍 Step 2: Bundle Analysis');
    const bundleSizes = await analyzeBundleSizes();
    
    // 3. Check size limits
    console.log('\n📍 Step 3: Size Limits');
    const sizeLimitResults = await runSizeLimitCheck();
    
    // 4. Save historical data
    await savePerformanceData(buildResults, bundleSizes, sizeLimitResults);
    
    // 5. Generate report
    await generatePerformanceReport(buildResults, bundleSizes, sizeLimitResults);
    
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`\n🎉 Performance monitoring completed in ${totalTime.toFixed(2)}s`);
    
    // Exit with error if any builds failed or size limits exceeded
    const hasBuildFailures = buildResults.some(r => !r.success);
    const hasSizeViolations = sizeLimitResults && sizeLimitResults.violations > 0;
    
    if (hasBuildFailures || hasSizeViolations) {
      console.log('\n⚠️  Performance issues detected - see report above');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Performance monitoring failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  measureBuildTime,
  analyzeBundleSizes,
  runSizeLimitCheck,
  generatePerformanceReport
};
