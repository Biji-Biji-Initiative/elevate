#!/bin/bash

echo "========================================="
echo "MS Elevate Indonesia - Clerk Setup Guide"
echo "========================================="
echo ""
echo "This script will guide you through setting up Clerk authentication."
echo ""
echo "Step 1: Create a Clerk Application"
echo "-----------------------------------"
echo "1. Go to https://dashboard.clerk.com"
echo "2. Sign in to your Clerk account"
echo "3. Click 'Create application'"
echo "4. Name it: 'MS Elevate Indonesia'"
echo "5. Select authentication methods:"
echo "   - Enable 'Google' OAuth"
echo "   - Disable other methods (Email, Username, etc.)"
echo ""
echo "Step 2: Configure Google OAuth"
echo "-------------------------------"
echo "1. In Clerk Dashboard > Configure > SSO Connections > Google"
echo "2. Click 'Use custom credentials'"
echo "3. Add these OAuth credentials from Google Cloud:"
echo ""
echo "Google Cloud Project: ms-elevate-indonesia-2025"
echo "OAuth 2.0 Client ID: (from Google Cloud Console)"
echo "OAuth 2.0 Client Secret: (from Google Cloud Console)"
echo ""
echo "Authorized redirect URIs to add in Google Cloud:"
echo "- https://accounts.ms-elevate-indonesia.clerk.accounts.dev/v1/oauth_callback"
echo "- https://your-prod-domain.clerk.accounts.dev/v1/oauth_callback"
echo ""
echo "Step 3: Get Your API Keys"
echo "--------------------------"
echo "From Clerk Dashboard > API Keys, copy:"
echo "- Publishable key (starts with pk_)"
echo "- Secret key (starts with sk_)"
echo ""
echo "Step 4: Configure Webhook (Optional)"
echo "-------------------------------------"
echo "1. Go to Webhooks in Clerk Dashboard"
echo "2. Create endpoint: https://your-domain.vercel.app/api/clerk/webhook"
echo "3. Select events: user.created, user.updated"
echo "4. Copy the Signing Secret"
echo ""
echo "Step 5: Update Environment Variables"
echo "-------------------------------------"
echo "Add these to your .env.local files:"
echo ""
echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_..."
echo "CLERK_SECRET_KEY=sk_..."
echo "CLERK_WEBHOOK_SECRET=whsec_... (if using webhooks)"
echo ""
echo "========================================="
echo ""
read -p "Press Enter when you've completed the Clerk dashboard setup..."

# Check if user wants to update env files
echo ""
read -p "Do you want to update the .env.local files now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo ""
    read -p "Enter your Clerk Publishable Key (pk_...): " CLERK_PK
    read -p "Enter your Clerk Secret Key (sk_...): " CLERK_SK
    read -p "Enter your Clerk Webhook Secret (optional, press Enter to skip): " CLERK_WH
    
    # Update web app env
    if [ -f "apps/web/.env.local" ]; then
        sed -i.bak "s|NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=.*|NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PK|" apps/web/.env.local
        sed -i.bak "s|CLERK_SECRET_KEY=.*|CLERK_SECRET_KEY=$CLERK_SK|" apps/web/.env.local
        if [ ! -z "$CLERK_WH" ]; then
            sed -i.bak "s|CLERK_WEBHOOK_SECRET=.*|CLERK_WEBHOOK_SECRET=$CLERK_WH|" apps/web/.env.local
        fi
        echo "✅ Updated apps/web/.env.local"
    fi
    
    # Update admin app env
    if [ -f "apps/admin/.env.local" ]; then
        sed -i.bak "s|NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=.*|NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PK|" apps/admin/.env.local
        sed -i.bak "s|CLERK_SECRET_KEY=.*|CLERK_SECRET_KEY=$CLERK_SK|" apps/admin/.env.local
        echo "✅ Updated apps/admin/.env.local"
    fi
    
    # Add Resend API key
    echo ""
    echo "Adding Resend API key..."
    RESEND_KEY="re_H7A8pYJd_9HD8ZuhNtUhTstgieKrj8cAf"
    
    if [ -f "apps/web/.env.local" ]; then
        if ! grep -q "RESEND_API_KEY=" apps/web/.env.local; then
            echo "" >> apps/web/.env.local
            echo "# Email Service (Resend)" >> apps/web/.env.local
            echo "RESEND_API_KEY=$RESEND_KEY" >> apps/web/.env.local
            echo "FROM_EMAIL=noreply@elevate-indonesia.com" >> apps/web/.env.local
            echo "REPLY_TO_EMAIL=support@elevate-indonesia.com" >> apps/web/.env.local
        else
            sed -i.bak "s|RESEND_API_KEY=.*|RESEND_API_KEY=$RESEND_KEY|" apps/web/.env.local
        fi
        echo "✅ Added Resend API key to apps/web/.env.local"
    fi
    
    if [ -f "apps/admin/.env.local" ]; then
        if ! grep -q "RESEND_API_KEY=" apps/admin/.env.local; then
            echo "" >> apps/admin/.env.local
            echo "# Email Service (Resend)" >> apps/admin/.env.local
            echo "RESEND_API_KEY=$RESEND_KEY" >> apps/admin/.env.local
            echo "FROM_EMAIL=noreply@elevate-indonesia.com" >> apps/admin/.env.local
            echo "REPLY_TO_EMAIL=support@elevate-indonesia.com" >> apps/admin/.env.local
        else
            sed -i.bak "s|RESEND_API_KEY=.*|RESEND_API_KEY=$RESEND_KEY|" apps/admin/.env.local
        fi
        echo "✅ Added Resend API key to apps/admin/.env.local"
    fi
    
    # Clean up backup files
    rm -f apps/web/.env.local.bak apps/admin/.env.local.bak
    
    echo ""
    echo "✅ Environment variables updated successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Test locally: pnpm dev"
    echo "2. Deploy to Vercel: ./deploy-vercel.sh"
fi

echo ""
echo "========================================="
echo "Setup complete! You can now run:"
echo "  pnpm dev    - to test locally"
echo "  ./deploy-vercel.sh - to deploy to production"
echo "========================================="