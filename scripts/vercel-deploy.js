#!/usr/bin/env node

/**
 * Comprehensive Vercel Deployment Script for MS Elevate Indonesia
 * Handles monorepo deployment with all environment variables
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Environment variables for production
const ENV_VARS = {
  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_aW4tcmVkYmlyZC02Mi5jbGVyay5hY2NvdW50cy5kZXYk',
  CLERK_SECRET_KEY: 'sk_test_tWQvYNgYTjrtpr5JARVLwaT8rqGAkwNQWRpbEbcxsa',
  CLERK_WEBHOOK_SECRET: 'whsec_2v7DTTZcJytslXWs8SjOMfwjV+vmVeQvft7zHMJL5Zw=',
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: 'https://gsvhfcjmjnocxxosjloi.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdmhmY2ptam5vY3h4b3NqbG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MDAwNDgsImV4cCI6MjA3MjM3NjA0OH0.yNzspqL27r9ML_yT7JZiaCSXDnLPdvOibEDeyIJmav0',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdmhmY2ptam5vY3h4b3NqbG9pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgwMDA0OCwiZXhwIjoyMDcyMzc2MDQ4fQ._EMvj8nN3SSB_p0WmTSR9VC0pd5e6wPWWCB32Se0was',
  DATABASE_URL: 'postgresql://postgres.gsvhfcjmjnocxxosjloi:ElevateIndo2025!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  
  // Kajabi
  KAJABI_API_KEY: '3bSjqrBysXjszB3TtFgSSKSV',
  KAJABI_CLIENT_SECRET: 'bEiFQSQiRzeyHZxfP4En52oo',
  KAJABI_SITE: 'academy.mereka.my',
  KAJABI_COMPLETION_TAG: 'elevate-ai-1-completed',
  KAJABI_OFFER_ID: 'r8LNCZ3f',
  
  // Resend
  RESEND_API_KEY: 're_H7A8pYJd_9HD8ZuhNtUhTstgieKrj8cAf',
  FROM_EMAIL: 'noreply@elevate-indonesia.com',
  REPLY_TO_EMAIL: 'support@elevate-indonesia.com'
};

function runCommand(cmd, options = {}) {
  console.log(`Running: ${cmd}`);
  try {
    const result = execSync(cmd, {
      stdio: 'inherit',
      encoding: 'utf8',
      ...options
    });
    return result;
  } catch (error) {
    console.error(`Error running command: ${cmd}`);
    throw error;
  }
}

async function deployApp(appName, appPath) {
  console.log(`\n========================================`);
  console.log(`Deploying ${appName}...`);
  console.log(`========================================\n`);
  
  // Change to app directory
  process.chdir(appPath);
  
  // Set environment variables
  console.log('Setting environment variables...');
  for (const [key, value] of Object.entries(ENV_VARS)) {
    // For web app, set NEXT_PUBLIC_SITE_URL specific to web
    if (appName === 'Web App' && key === 'NEXT_PUBLIC_SITE_URL') {
      continue; // Skip, will be set after deployment
    }
    
    try {
      runCommand(`vercel env rm ${key} production --yes`, { stdio: 'pipe' });
    } catch (e) {
      // Ignore if env var doesn't exist
    }
    
    // Add the environment variable
    runCommand(`echo "${value}" | vercel env add ${key} production`);
  }
  
  // Link project
  console.log('Linking Vercel project...');
  runCommand('vercel link --yes');
  
  // Deploy
  console.log('Deploying to production...');
  const deployOutput = runCommand('vercel --prod --yes', { 
    stdio: 'pipe',
    encoding: 'utf8'
  });
  
  // Extract deployment URL
  const urlMatch = deployOutput.match(/https:\/\/[\w-]+\.vercel\.app/);
  const deploymentUrl = urlMatch ? urlMatch[0] : null;
  
  if (deploymentUrl) {
    console.log(`✅ ${appName} deployed to: ${deploymentUrl}`);
    
    // Set NEXT_PUBLIC_SITE_URL after deployment
    runCommand(`echo "${deploymentUrl}" | vercel env add NEXT_PUBLIC_SITE_URL production`);
  }
  
  return deploymentUrl;
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  
  console.log('MS Elevate Indonesia - Production Deployment');
  console.log('=============================================');
  console.log('');
  
  // Check if we're in the right directory
  if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
    console.error('❌ Please run this script from the project root');
    process.exit(1);
  }
  
  // Install dependencies and generate Prisma client
  console.log('Installing dependencies and generating Prisma client...');
  process.chdir(rootDir);
  runCommand('pnpm install');
  runCommand('pnpm db:generate');
  
  // Deploy Web App
  const webUrl = await deployApp('Web App', path.join(rootDir, 'apps/web'));
  
  // Deploy Admin App
  const adminUrl = await deployApp('Admin App', path.join(rootDir, 'apps/admin'));
  
  console.log('\n========================================');
  console.log('✅ Deployment Complete!');
  console.log('========================================');
  console.log('');
  console.log('Production URLs:');
  console.log(`  Web App:   ${webUrl || 'Check Vercel dashboard'}`);
  console.log(`  Admin App: ${adminUrl || 'Check Vercel dashboard'}`);
  console.log('');
  console.log('Next Steps:');
  console.log('1. Configure Clerk webhook:');
  console.log(`   - Endpoint URL: ${webUrl}/api/webhooks/clerk`);
  console.log('   - Events: user.created, user.updated, user.deleted');
  console.log('2. Update Google OAuth redirect URIs in Google Cloud Console');
  console.log('3. Test authentication flow');
  console.log('');
}

main().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
});