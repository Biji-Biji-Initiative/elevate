#!/bin/bash

echo "Setting up Vercel deployment for MS Elevate Indonesia"

# Set environment variables
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production <<< "pk_test_aW4tcmVkYmlyZC02Mi5jbGVyay5hY2NvdW50cy5kZXYk"
vercel env add CLERK_SECRET_KEY production <<< "sk_test_tWQvYNgYTjrtpr5JARVLwaT8rqGAkwNQWRpbEbcxsa"
vercel env add CLERK_WEBHOOK_SECRET production <<< "whsec_dummy_placeholder"
vercel env add NEXT_PUBLIC_SUPABASE_URL production <<< "https://gsvhfcjmjnocxxosjloi.supabase.co"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdmhmY2ptam5vY3h4b3NqbG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MDAwNDgsImV4cCI6MjA3MjM3NjA0OH0.yNzspqL27r9ML_yT7JZiaCSXDnLPdvOibEDeyIJmav0"
vercel env add SUPABASE_SERVICE_ROLE_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdmhmY2ptam5vY3h4b3NqbG9pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgwMDA0OCwiZXhwIjoyMDcyMzc2MDQ4fQ._EMvj8nN3SSB_p0WmTSR9VC0pd5e6wPWWCB32Se0was"
vercel env add DATABASE_URL production <<< "postgresql://postgres.gsvhfcjmjnocxxosjloi:ElevateIndo2025!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
vercel env add NEXT_PUBLIC_SITE_URL production <<< "https://elevate-indonesia.vercel.app"
vercel env add KAJABI_WEBHOOK_SECRET production < /dev/null
vercel env add KAJABI_API_KEY production <<< "ka_dummy_api_key"
vercel env add KAJABI_CLIENT_SECRET production <<< "ka_dummy_client_secret"
vercel env add KAJABI_SITE production <<< "academy.mereka.my"
# Optional: Site-scoped Kajabi base URL
vercel env add KAJABI_BASE_URL production <<< "https://academy.mereka.my/api"
vercel env add KAJABI_OFFER_ID production <<< "r8LNCZ3f"
vercel env add RESEND_API_KEY production <<< "re_dummy_key"
vercel env add FROM_EMAIL production <<< "noreply@elevate-indonesia.com"
vercel env add REPLY_TO_EMAIL production <<< "support@elevate-indonesia.com"

echo "Environment variables configured"
echo ""
echo "Now deploying to Vercel..."
vercel --prod
