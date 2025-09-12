#!/usr/bin/env node

/**
 * Vercel Configuration Verification Script
 * 
 * This script verifies that the Vercel deployment configurations
 * are properly set up for both web and admin apps.
 */

const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function loadJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function main() {
  log('🔍 Verifying Vercel Configuration', 'blue');
  log('=====================================\n', 'blue');

  const rootDir = path.resolve(__dirname, '..');
  const webAppDir = path.join(rootDir, 'apps', 'web');
  const adminAppDir = path.join(rootDir, 'apps', 'admin');

  let hasErrors = false;
  let hasWarnings = false;

  // Check root-level Vercel configs (one per app)
  log('📱 Web App (root vercel-web.json)', 'cyan');
  log('----------------------------------', 'cyan');

  const webRootConfigPath = path.join(rootDir, 'vercel-web.json');
  if (!checkFileExists(webRootConfigPath)) {
    log('❌ vercel-web.json not found at repo root', 'red');
    hasErrors = true;
  } else {
    const config = loadJsonFile(webRootConfigPath);
    if (!config) {
      log('❌ vercel-web.json is invalid JSON', 'red');
      hasErrors = true;
    } else {
      log('✅ vercel-web.json exists and is valid', 'green');
      if (config.buildCommand === 'pnpm turbo run build --filter=web') {
        log('✅ Web build command OK', 'green');
      } else {
        log(`❌ Web build command incorrect: ${config.buildCommand}`, 'red');
        hasErrors = true;
      }
      if (config.installCommand && config.installCommand.startsWith('pnpm install')) {
        log('✅ Web install command present', 'green');
      } else {
        log('❌ Web install command missing/incorrect', 'red');
        hasErrors = true;
      }
      if (config.outputDirectory === 'apps/web/.next') {
        log('✅ Web output directory OK', 'green');
      } else {
        log('❌ Web output directory incorrect', 'red');
        hasErrors = true;
      }
    }
  }

  // Skip .vercel checks; project linking varies locally

  log('\n🔧 Admin App (root vercel-admin.json)', 'cyan');
  log('------------------------------------', 'cyan');
  const adminRootConfigPath = path.join(rootDir, 'vercel-admin.json');
  if (!checkFileExists(adminRootConfigPath)) {
    log('❌ vercel-admin.json not found at repo root', 'red');
    hasErrors = true;
  } else {
    const config = loadJsonFile(adminRootConfigPath);
    if (!config) {
      log('❌ vercel-admin.json is invalid JSON', 'red');
      hasErrors = true;
    } else {
      log('✅ vercel-admin.json exists and is valid', 'green');
      if (config.buildCommand === 'pnpm turbo run build --filter=elevate-admin') {
        log('✅ Admin build command OK', 'green');
      } else {
        log(`❌ Admin build command incorrect: ${config.buildCommand}`, 'red');
        hasErrors = true;
      }
      if (config.installCommand && config.installCommand.startsWith('pnpm install')) {
        log('✅ Admin install command present', 'green');
      } else {
        log('❌ Admin install command missing/incorrect', 'red');
        hasErrors = true;
      }
      if (config.outputDirectory === 'apps/admin/.next') {
        log('✅ Admin output directory OK', 'green');
      } else {
        log('❌ Admin output directory incorrect', 'red');
        hasErrors = true;
      }
    }
  }

  // Warn if app-level vercel.json files exist (deprecated)
  const webAppVercel = path.join(webAppDir, 'vercel.json');
  const adminAppVercel = path.join(adminAppDir, 'vercel.json');
  if (checkFileExists(webAppVercel)) {
    log('⚠️  apps/web/vercel.json present but deprecated. Delete it.', 'yellow');
    hasWarnings = true;
  }
  if (checkFileExists(adminAppVercel)) {
    log('⚠️  apps/admin/vercel.json present but deprecated. Delete it.', 'yellow');
    hasWarnings = true;
  }

  // Check deployment scripts
  log('\n🚀 Deployment Scripts', 'cyan');
  log('---------------------', 'cyan');

  const deployWebScript = path.join(rootDir, 'scripts', 'deploy-web.sh');
  const deployAdminScript = path.join(rootDir, 'scripts', 'deploy-admin.sh');
  const deployAppsScript = path.join(rootDir, 'scripts', 'deploy-apps.sh');

  if (checkFileExists(deployWebScript)) {
    log('✅ Web deployment script exists', 'green');
  } else {
    log('⚠️  Web deployment script missing', 'yellow');
    hasWarnings = true;
  }

  if (checkFileExists(deployAdminScript)) {
    log('✅ Admin deployment script exists', 'green');
  } else {
    log('⚠️  Admin deployment script missing', 'yellow');
    hasWarnings = true;
  }

  if (checkFileExists(deployAppsScript)) {
    log('✅ Combined deployment script exists', 'green');
  } else {
    log('⚠️  Combined deployment script missing', 'yellow');
    hasWarnings = true;
  }

  // Check package.json configurations
  log('\n📦 Package Configurations', 'cyan');
  log('-------------------------', 'cyan');

  const rootPackageJson = path.join(rootDir, 'package.json');
  const webPackageJson = path.join(webAppDir, 'package.json');
  const adminPackageJson = path.join(adminAppDir, 'package.json');

  const rootPkg = loadJsonFile(rootPackageJson);
  const webPkg = loadJsonFile(webPackageJson);
  const adminPkg = loadJsonFile(adminPackageJson);

  if (webPkg && webPkg.name === 'web') {
    log('✅ Web app package name is correct', 'green');
  } else {
    log('❌ Web app package name should be "web"', 'red');
    hasErrors = true;
  }

  if (adminPkg && adminPkg.name === 'elevate-admin') {
    log('✅ Admin app package name is correct', 'green');
  } else {
    log('❌ Admin app package name should be "elevate-admin"', 'red');
    hasErrors = true;
  }

  // Final summary
  log('\n📋 Configuration Summary', 'blue');
  log('=======================', 'blue');

  if (hasErrors) {
    log('❌ Configuration has errors that need to be fixed', 'red');
    process.exit(1);
  } else if (hasWarnings) {
    log('⚠️  Configuration has warnings but should work', 'yellow');
    log('💡 Consider addressing warnings for optimal setup', 'yellow');
    process.exit(0);
  } else {
    log('✅ All configurations look good!', 'green');
    log('🚀 Ready for deployment', 'green');
    process.exit(0);
  }
}

// Run the verification
if (require.main === module) {
  main();
}

module.exports = { main };
