#!/usr/bin/env node

/**
 * Automated Clerk Setup for MS Elevate Indonesia
 * 
 * This script automates the Clerk application setup process.
 * You'll need a Clerk account and access token.
 */

const fs = require('fs');
const https = require('https');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function makeClerkAPIRequest(endpoint, method, data, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.clerk.com',
      port: 443,
      path: `/v1${endpoint}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function setupClerk() {
  console.log('========================================');
  console.log('MS Elevate Indonesia - Automated Clerk Setup');
  console.log('========================================');
  console.log('');
  console.log('This will help you create and configure a Clerk application.');
  console.log('');
  
  // Get Clerk Dashboard API token
  console.log('To get your Clerk Dashboard API token:');
  console.log('1. Go to https://dashboard.clerk.com');
  console.log('2. Click on your profile > Personal workspace');
  console.log('3. Go to API Keys');
  console.log('4. Create a new Dashboard API key');
  console.log('');
  
  const token = await question('Enter your Clerk Dashboard API token: ');
  
  if (!token) {
    console.log('❌ Token is required');
    process.exit(1);
  }
  
  console.log('');
  console.log('Creating Clerk application for MS Elevate Indonesia...');
  
  try {
    // Create the application
    const appData = {
      name: 'MS Elevate Indonesia',
      public: false
    };
    
    const createResponse = await makeClerkAPIRequest('/applications', 'POST', appData, token);
    
    if (createResponse.errors) {
      console.log('❌ Failed to create application:', createResponse.errors);
      console.log('');
      console.log('If the application already exists, please get the keys from:');
      console.log('https://dashboard.clerk.com');
    } else {
      console.log('✅ Application created successfully!');
      console.log('');
      console.log('Application ID:', createResponse.id);
      console.log('');
      
      // Configure Google OAuth
      console.log('Configuring Google OAuth...');
      const oauthConfig = {
        strategy: 'oauth_google',
        enabled: true
      };
      
      await makeClerkAPIRequest(`/applications/${createResponse.id}/oauth_applications`, 'POST', oauthConfig, token);
      console.log('✅ Google OAuth configured');
      
      console.log('');
      console.log('========================================');
      console.log('Next Steps:');
      console.log('========================================');
      console.log('');
      console.log('1. Go to your Clerk Dashboard');
      console.log('2. Select "MS Elevate Indonesia" application');
      console.log('3. Configure Google OAuth with custom credentials');
      console.log('4. Copy the API keys');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('');
  const hasKeys = await question('Do you have your Clerk API keys ready? (y/n): ');
  
  if (hasKeys.toLowerCase() === 'y') {
    await updateEnvFiles();
  } else {
    console.log('');
    console.log('Please get your keys from https://dashboard.clerk.com');
    console.log('Then run: npm run setup:clerk-env');
  }
  
  rl.close();
}

async function updateEnvFiles() {
  console.log('');
  const publishableKey = await question('Enter your Clerk Publishable Key (pk_...): ');
  const secretKey = await question('Enter your Clerk Secret Key (sk_...): ');
  const webhookSecret = await question('Enter your Clerk Webhook Secret (optional, press Enter to skip): ');
  
  // Update web app .env.local
  const webEnvPath = path.join(__dirname, '../apps/web/.env.local');
  const adminEnvPath = path.join(__dirname, '../apps/admin/.env.local');
  const resendKey = 're_H7A8pYJd_9HD8ZuhNtUhTstgieKrj8cAf';
  
  // Update web env
  if (fs.existsSync(webEnvPath)) {
    let webEnv = fs.readFileSync(webEnvPath, 'utf8');
    webEnv = webEnv.replace(/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=.*/g, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${publishableKey}`);
    webEnv = webEnv.replace(/CLERK_SECRET_KEY=.*/g, `CLERK_SECRET_KEY=${secretKey}`);
    if (webhookSecret) {
      webEnv = webEnv.replace(/CLERK_WEBHOOK_SECRET=.*/g, `CLERK_WEBHOOK_SECRET=${webhookSecret}`);
    }
    
    // Add Resend API key if not present
    if (!webEnv.includes('RESEND_API_KEY=')) {
      webEnv += `\n# Email Service (Resend)\nRESEND_API_KEY=${resendKey}\nFROM_EMAIL=noreply@elevate-indonesia.com\nREPLY_TO_EMAIL=support@elevate-indonesia.com\n`;
    } else {
      webEnv = webEnv.replace(/RESEND_API_KEY=.*/g, `RESEND_API_KEY=${resendKey}`);
    }
    
    fs.writeFileSync(webEnvPath, webEnv);
    console.log('✅ Updated apps/web/.env.local');
  }
  
  // Update admin env
  if (fs.existsSync(adminEnvPath)) {
    let adminEnv = fs.readFileSync(adminEnvPath, 'utf8');
    adminEnv = adminEnv.replace(/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=.*/g, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${publishableKey}`);
    adminEnv = adminEnv.replace(/CLERK_SECRET_KEY=.*/g, `CLERK_SECRET_KEY=${secretKey}`);
    
    // Add Resend API key if not present
    if (!adminEnv.includes('RESEND_API_KEY=')) {
      adminEnv += `\n# Email Service (Resend)\nRESEND_API_KEY=${resendKey}\nFROM_EMAIL=noreply@elevate-indonesia.com\nREPLY_TO_EMAIL=support@elevate-indonesia.com\n`;
    } else {
      adminEnv = adminEnv.replace(/RESEND_API_KEY=.*/g, `RESEND_API_KEY=${resendKey}`);
    }
    
    fs.writeFileSync(adminEnvPath, adminEnv);
    console.log('✅ Updated apps/admin/.env.local');
  }
  
  console.log('');
  console.log('========================================');
  console.log('✅ Environment variables updated successfully!');
  console.log('========================================');
  console.log('');
  console.log('You can now:');
  console.log('  1. Test locally: pnpm dev');
  console.log('  2. Deploy to Vercel: ./deploy-vercel.sh');
}

// Run the setup
setupClerk().catch(console.error);