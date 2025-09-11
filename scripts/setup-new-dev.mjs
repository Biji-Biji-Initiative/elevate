#!/usr/bin/env node

/**
 * Comprehensive setup script for new developers
 * Runs all necessary steps to get the development environment ready
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

const steps = [
  {
    name: 'Validate TypeScript Configuration',
    command: 'node scripts/validate-tsconfig.mjs',
    description: 'Check for duplicate references and config issues'
  },
  {
    name: 'Install Dependencies', 
    command: 'pnpm install',
    description: 'Install all workspace dependencies'
  },
  {
    name: 'Build Types (Stage 1)',
    command: 'pnpm run typecheck:build',
    description: 'Type-check entire workspace in dependency order'
  },
  {
    name: 'Build Packages (Stage 2)', 
    command: 'pnpm -r --filter "@elevate/*" run build:js',
    description: 'Build JavaScript artifacts for all packages'
  },
  {
    name: 'Verify Build Health',
    command: 'node scripts/verify-build-health.mjs',
    description: 'Ensure all packages are properly built'
  },
  {
    name: 'Database Setup Check',
    command: 'node -e "console.log(process.env.DATABASE_URL ? \'✅ Database URL configured\' : \'❌ DATABASE_URL not set\')"',
    description: 'Verify database connection is configured'
  }
];

async function runSetup() {
  console.log('🚀 Setting up development environment for MS Elevate LEAPS Tracker\n');
  
  let failedSteps = [];
  
  for (const [index, step] of steps.entries()) {
    const stepNumber = index + 1;
    console.log(`\n📋 Step ${stepNumber}/${steps.length}: ${step.name}`);
    console.log(`   ${step.description}`);
    console.log(`   Running: ${step.command}\n`);
    
    try {
      const { stdout, stderr } = await execAsync(step.command);
      
      if (stdout) {
        console.log(stdout);
      }
      
      if (stderr && !stderr.includes('warn')) {
        console.log('⚠️  Warnings:', stderr);
      }
      
      console.log(`✅ Step ${stepNumber} completed successfully`);
      
    } catch (error) {
      console.error(`❌ Step ${stepNumber} failed:`, error.message);
      failedSteps.push({ step: stepNumber, name: step.name, error: error.message });
      
      // Some steps can fail but we continue (like optional checks)
      const canContinue = step.name.includes('Check') || step.name.includes('Verify');
      if (!canContinue) {
        break;
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (failedSteps.length === 0) {
    console.log('🎉 Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. cd apps/web && pnpm dev  # Start the web application');
    console.log('2. Visit http://localhost:5000 in your browser');
    console.log('\n💡 For troubleshooting, see: TROUBLESHOOTING.md');
  } else {
    console.log('❌ Setup failed with the following issues:\n');
    failedSteps.forEach(({ step, name, error }) => {
      console.log(`   Step ${step} (${name}): ${error}`);
    });
    
    console.log('\n🔧 Common solutions:');
    console.log('- Check that Node.js version is >= 20.11');
    console.log('- Ensure pnpm is installed: npm install -g pnpm');
    console.log('- Clear cache: pnpm store prune && rm -rf node_modules');
    console.log('- Check BUILDING.md for detailed build instructions');
    
    process.exit(1);
  }
}

// Preflight checks
function preflightChecks() {
  console.log('🔍 Running preflight checks...');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 20) {
    console.error(`❌ Node.js version ${nodeVersion} is not supported. Please upgrade to Node.js 20.11 or higher.`);
    process.exit(1);
  }
  
  console.log(`✅ Node.js ${nodeVersion} is supported`);
  
  // Check if pnpm is available
  try {
    execAsync('pnpm --version');
    console.log('✅ pnpm is available');
  } catch (error) {
    console.error('❌ pnpm is not installed. Please install it: npm install -g pnpm');
    process.exit(1);
  }
  
  // Check if we're in the right directory
  if (!existsSync('package.json') || !existsSync('packages')) {
    console.error('❌ This does not appear to be the root of the monorepo. Please run this script from the root directory.');
    process.exit(1);
  }
  
  console.log('✅ All preflight checks passed\n');
}

// Run setup
preflightChecks();
runSetup();