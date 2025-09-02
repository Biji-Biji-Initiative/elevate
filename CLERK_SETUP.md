# Clerk Authentication Setup Guide

## Quick Setup Steps

### 1. Create Clerk Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Sign in to your Clerk account
3. Click **"Create application"**
4. Name it: **"MS Elevate Indonesia"**
5. Select authentication method: **Google OAuth only**

### 2. Configure Google OAuth

#### In Google Cloud Console:
1. Project Name: `ms-elevate-indonesia-2025` (already created)
2. Go to **APIs & Services > Credentials**
3. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: MS Elevate Indonesia
   - Authorized JavaScript origins:
     - `https://accounts.ms-elevate-indonesia.clerk.accounts.dev`
     - `https://elevate-indonesia.vercel.app`
   - Authorized redirect URIs:
     - `https://accounts.ms-elevate-indonesia.clerk.accounts.dev/v1/oauth_callback`
     - `https://elevate-indonesia.vercel.app/sign-in/sso-callback`

#### In Clerk Dashboard:
1. Go to **Configure > SSO Connections > Google**
2. Click **"Use custom credentials"**
3. Add your Google OAuth credentials:
   - Client ID: (from Google Cloud Console)
   - Client Secret: (from Google Cloud Console)

### 3. Get Your API Keys

From Clerk Dashboard > **API Keys**, copy:
- **Publishable key** (starts with `pk_`)
- **Secret key** (starts with `sk_`)

### 4. Configure Webhook (Optional but Recommended)

1. Go to **Webhooks** in Clerk Dashboard
2. Create endpoint: `https://elevate-indonesia.vercel.app/api/clerk/webhook`
3. Select events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy the **Signing Secret**

### 5. Update Environment Variables

Run the setup script:
```bash
pnpm setup:clerk
```

Or manually update `.env.local` files:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Resend Email (already configured)
RESEND_API_KEY=re_H7A8pYJd_9HD8ZuhNtUhTstgieKrj8cAf
```

## Production Deployment Checklist

- [ ] Clerk application created
- [ ] Google OAuth configured with custom credentials
- [ ] API keys obtained from Clerk
- [ ] Environment variables updated
- [ ] Webhook endpoint configured (optional)
- [ ] Test authentication flow locally
- [ ] Deploy to Vercel

## Testing Authentication

1. Start development server:
   ```bash
   pnpm dev
   ```

2. Visit http://localhost:3000

3. Click "Sign In" and test Google OAuth

4. Verify user creation in Clerk Dashboard

## Troubleshooting

### Common Issues:

1. **"Invalid client" error**: Check Google OAuth credentials match exactly
2. **Redirect URI mismatch**: Ensure all URIs are added in Google Cloud Console
3. **User not created**: Check webhook configuration and secrets
4. **Permission denied**: Verify CLERK_SECRET_KEY is correct

### Debug Commands:

```bash
# Check environment variables
pnpm env:check

# View Clerk logs
# Go to Clerk Dashboard > Logs

# Test webhook locally
ngrok http 3000
# Update webhook URL to ngrok URL temporarily
```

## Support

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Discord](https://discord.com/invite/b5rXHjAg7A)
- Project Issues: Create issue in repository