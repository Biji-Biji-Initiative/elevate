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

  // Check root vercel.json (web app)
  log('📱 Web App Configuration', 'cyan');
  log('-------------------------', 'cyan');
  
  const rootVercelConfig = path.join(rootDir, 'vercel.json');
  if (!checkFileExists(rootVercelConfig)) {
    log('❌ Root vercel.json not found', 'red');
    hasErrors = true;
  } else {
    const config = loadJsonFile(rootVercelConfig);
    if (!config) {
      log('❌ Root vercel.json is invalid JSON', 'red');
      hasErrors = true;
    } else {
      log('✅ Root vercel.json exists and is valid', 'green');
      
      // Check key properties
      if (config.name === 'elevate-web') {
        log('✅ Correct project name: elevate-web', 'green');
      } else {
        log(`⚠️  Project name should be 'elevate-web', found: ${config.name}`, 'yellow');
        hasWarnings = true;
      }

      if (config.buildCommand === 'pnpm turbo run build --filter=web') {
        log('✅ Correct build command for web app', 'green');
      } else {
        log('❌ Incorrect build command for web app', 'red');
        hasErrors = true;
      }

      if (config.outputDirectory === 'apps/web/.next') {
        log('✅ Correct output directory', 'green');
      } else {
        log('❌ Incorrect output directory', 'red');
        hasErrors = true;
      }

      if (config.functions && config.functions['apps/web/app/api/**/*.ts']) {
        log('✅ API function configuration present', 'green');
      } else {
        log('⚠️  API function configuration missing', 'yellow');
        hasWarnings = true;
      }

      if (config.headers && config.headers.some(h => h.headers.some(hdr => hdr.value === 'elevate-web'))) {
        log('✅ App identification header present', 'green');
      } else {
        log('⚠️  App identification header missing', 'yellow');
        hasWarnings = true;
      }
    }
  }

  // Check .vercel directory for web app
  const webVercelDir = path.join(rootDir, '.vercel');
  if (checkFileExists(webVercelDir)) {
    log('✅ Web app .vercel directory exists', 'green');
    const webProjectJson = path.join(webVercelDir, 'project.json');
    if (checkFileExists(webProjectJson)) {
      log('✅ Web app project.json exists', 'green');
      const projectConfig = loadJsonFile(webProjectJson);
      if (projectConfig && projectConfig.projectId) {
        log(`✅ Project ID: ${projectConfig.projectId}`, 'green');
      }
    }
  } else {
    log('⚠️  Web app .vercel directory not found (will be created on first deploy)', 'yellow');
    hasWarnings = true;
  }

  log('\n🔧 Admin App Configuration', 'cyan');
  log('---------------------------', 'cyan');

  // Check admin vercel.json
  const adminVercelConfig = path.join(adminAppDir, 'vercel.json');
  if (!checkFileExists(adminVercelConfig)) {
    log('❌ Admin vercel.json not found', 'red');
    hasErrors = true;
  } else {
    const config = loadJsonFile(adminVercelConfig);
    if (!config) {
      log('❌ Admin vercel.json is invalid JSON', 'red');
      hasErrors = true;
    } else {
      log('✅ Admin vercel.json exists and is valid', 'green');
      
      // Check key properties
      if (config.name === 'elevate-admin') {
        log('✅ Correct project name: elevate-admin', 'green');
      } else {
        log(`⚠️  Project name should be 'elevate-admin', found: ${config.name}`, 'yellow');
        hasWarnings = true;
      }

      if (config.buildCommand === 'cd ../.. && pnpm turbo run build --filter=elevate-admin') {
        log('✅ Correct build command for admin app', 'green');
      } else {
        log('❌ Incorrect build command for admin app', 'red');
        hasErrors = true;
      }

      if (config.outputDirectory === '.next') {
        log('✅ Correct output directory', 'green');
      } else {
        log('❌ Incorrect output directory', 'red');
        hasErrors = true;
      }

      if (config.functions && config.functions['app/api/**/*.ts']) {
        log('✅ API function configuration present', 'green');
      } else {
        log('⚠️  API function configuration missing', 'yellow');
        hasWarnings = true;
      }

      if (config.headers && config.headers.some(h => h.headers.some(hdr => hdr.value === 'elevate-admin'))) {
        log('✅ App identification header present', 'green');
      } else {
        log('⚠️  App identification header missing', 'yellow');
        hasWarnings = true;
      }
    }
  }

  // Check admin .vercel directory
  const adminVercelDir = path.join(adminAppDir, '.vercel');
  if (checkFileExists(adminVercelDir)) {
    log('✅ Admin app .vercel directory exists', 'green');
    const adminProjectJson = path.join(adminVercelDir, 'project.json');
    if (checkFileExists(adminProjectJson)) {
      log('✅ Admin app project.json exists', 'green');
      const projectConfig = loadJsonFile(adminProjectJson);
      if (projectConfig && projectConfig.projectId) {
        log(`✅ Project ID: ${projectConfig.projectId}`, 'green');
      }
    }
  } else {
    log('⚠️  Admin app .vercel directory not found (will be created on first deploy)', 'yellow');
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