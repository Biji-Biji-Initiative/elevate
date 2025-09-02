#!/bin/bash

echo "========================================="
echo "MS Elevate Indonesia - Vercel Deployment"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "apps" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Function to deploy an app
deploy_app() {
    local app_name=$1
    local app_dir=$2
    local prod_url=$3
    
    echo ""
    echo "Deploying $app_name..."
    echo "------------------------"
    
    cd "$app_dir"
    
    # Link to project (or create new)
    vercel link --yes
    
    # Pull environment variables
    vercel env pull .env.production.local
    
    # Deploy to production
    vercel --prod --yes
    
    echo "✅ $app_name deployed successfully!"
    echo "URL: $prod_url"
    
    cd ../..
}

# Check for required environment variables
echo "Checking environment setup..."

if [ ! -f "apps/web/.env.local" ]; then
    echo "❌ Missing apps/web/.env.local"
    echo "Please run: pnpm setup:clerk"
    exit 1
fi

if [ ! -f "apps/admin/.env.local" ]; then
    echo "❌ Missing apps/admin/.env.local"
    echo "Please run: pnpm setup:clerk"
    exit 1
fi

# Check if Clerk keys are configured
if grep -q "pk_test_your_publishable_key_here" apps/web/.env.local; then
    echo "⚠️  Warning: Clerk keys not configured"
    echo "Please set up Clerk first: pnpm setup:clerk"
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Environment files found"
echo ""

# Build applications first
echo "Building applications..."
echo "------------------------"
pnpm build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix errors and try again."
    exit 1
fi

echo "✅ Build successful"
echo ""

# Deploy web app
echo "========================================="
echo "1. Deploying Web Application"
echo "========================================="
deploy_app "Web App" "apps/web" "https://elevate-indonesia.vercel.app"

# Deploy admin app
echo ""
echo "========================================="
echo "2. Deploying Admin Application"
echo "========================================="
deploy_app "Admin App" "apps/admin" "https://elevate-indonesia-admin.vercel.app"

echo ""
echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo ""
echo "Applications deployed:"
echo "  Web App:   https://elevate-indonesia.vercel.app"
echo "  Admin App: https://elevate-indonesia-admin.vercel.app"
echo ""
echo "Next steps:"
echo "1. Configure custom domains in Vercel Dashboard"
echo "2. Set up Clerk production keys"
echo "3. Configure production webhook URLs"
echo "4. Test authentication flow"
echo ""
echo "To view logs:"
echo "  vercel logs https://elevate-indonesia.vercel.app"
echo "  vercel logs https://elevate-indonesia-admin.vercel.app"
echo "========================================="