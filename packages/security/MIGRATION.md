# CSP Implementation Migration Guide

This guide helps you migrate the MS Elevate LEAPS Tracker to use the new comprehensive Content Security Policy (CSP) implementation.

## Overview

The new CSP implementation provides:
- Dynamic nonce generation for inline scripts and styles
- Environment-aware security policies
- Comprehensive security headers
- CSP violation reporting and monitoring
- React hooks for CSP-compliant components

## Pre-Migration Checklist

### 1. Review Current Code
- [ ] Identify all inline scripts and styles
- [ ] List all external domains currently used
- [ ] Document any dynamic script/style generation
- [ ] Check for eval() usage or dynamic code execution

### 2. Environment Preparation
- [ ] Ensure development, staging, and production environments
- [ ] Set up monitoring for CSP violations
- [ ] Plan rollback strategy

### 3. Testing Setup
- [ ] Prepare test scenarios for all major user flows
- [ ] Set up automated testing for CSP compliance
- [ ] Plan manual testing checklist

## Migration Steps

### Phase 1: Setup and Testing (Report-Only Mode)

#### Step 1: Install and Configure

1. **Security package is already installed** in the monorepo at `packages/security`

2. **Update middleware files** (already done):
   - `apps/web/middleware.ts`
   - `apps/admin/middleware.ts`

3. **Update Next.js configs** (already done):
   - `apps/web/next.config.mjs`
   - `apps/admin/next.config.mjs`

4. **CSP reporting endpoints** (already created):
   - `apps/web/app/api/csp-report/route.ts`
   - `apps/admin/app/api/csp-report/route.ts`

#### Step 2: Enable Report-Only Mode

The implementation starts in report-only mode by default in development:

```typescript
// This is already configured in the middleware
const securityConfig = getSecurityConfig(); // Uses NODE_ENV
```

#### Step 3: Monitor and Identify Issues

1. **Start the applications**:
   ```bash
   pnpm dev # Runs both web and admin apps
   ```

2. **Check browser console** for CSP violations:
   - Open Developer Tools → Console
   - Look for CSP violation messages
   - Note blocked resources and inline content

3. **Check server logs** for violation reports:
   ```bash
   # Watch for CSP violation logs
   tail -f console.log | grep "CSP Violation"
   ```

4. **Test critical user flows**:
   - User registration and login
   - File uploads to Supabase
   - Dashboard interactions
   - Admin panel operations
   - Form submissions

#### Step 4: Document Violations

Create a violation report:

```markdown
## CSP Violations Found

### Inline Scripts
- Location: components/SomeComponent.tsx:45
- Content: onClick="handleClick()"
- Action: Replace with React event handler

### External Resources
- Blocked: https://example.com/script.js
- Usage: Analytics tracking
- Action: Add to allowedDomains.external

### Dynamic Content
- Location: utils/dynamicScript.ts
- Issue: document.createElement('script')
- Action: Use CSPScript component
```

### Phase 2: Fix Violations

#### Step 1: Replace Inline Scripts

**Before:**
```html
<script>
  console.log('Hello world');
</script>
```

**After:**
```tsx
import { CSPScript } from '@elevate/security/csp-hooks';

<CSPScript>
  {`console.log('Hello world');`}
</CSPScript>
```

#### Step 2: Replace Inline Styles

**Before:**
```html
<style>
  .my-class { color: red; }
</style>
```

**After:**
```tsx
import { CSPStyle } from '@elevate/security/csp-hooks';

<CSPStyle>
  {`.my-class { color: red; }`}
</CSPStyle>
```

#### Step 3: Handle Dynamic Scripts

**Before:**
```typescript
const script = document.createElement('script');
script.src = 'https://example.com/script.js';
document.head.appendChild(script);
```

**After:**
```typescript
import { executeWithNonce } from '@elevate/security/csp-hooks';

// For inline scripts
await executeWithNonce(`
  // Your script code here
`);

// For external scripts, add domain to CSP config
const config = {
  allowedDomains: {
    external: ['https://example.com']
  }
};
```

#### Step 4: Fix Event Handlers

**Before:**
```html
<button onclick="handleClick()">Click me</button>
```

**After:**
```tsx
<button onClick={handleClick}>Click me</button>
```

#### Step 5: Add Required Domains

Update middleware configuration:

```typescript
// In apps/web/middleware.ts or apps/admin/middleware.ts
const webSecurityConfig = {
  ...securityConfig,
  allowedDomains: {
    ...securityConfig.allowedDomains,
    external: [
      ...(securityConfig.allowedDomains?.external || []),
      'https://required-external-domain.com',
      'https://another-api.com'
    ],
    images: [
      ...(securityConfig.allowedDomains?.images || []),
      'https://custom-image-cdn.com'
    ]
  }
};
```

### Phase 3: Enable Enforcement

#### Step 1: Test in Staging

1. **Update staging environment**:
   ```typescript
   // Set NODE_ENV=staging or use explicit config
   const config = getSecurityConfig('staging');
   ```

2. **Deploy to staging**

3. **Run comprehensive tests**:
   - All user flows work correctly
   - No CSP violations in console
   - External resources load properly
   - Forms submit successfully

#### Step 2: Production Deployment

1. **Final pre-deployment checks**:
   - [ ] All CSP violations resolved
   - [ ] External domains properly configured
   - [ ] Violation reporting working
   - [ ] Rollback plan ready

2. **Deploy with monitoring**:
   ```bash
   pnpm deploy:prod
   ```

3. **Monitor for issues**:
   - Check CSP violation reports
   - Monitor application functionality
   - Watch for user-reported issues

## Component Migration Examples

### Form Components

**Before:**
```tsx
function ContactForm() {
  return (
    <form onSubmit="handleSubmit()">
      <script>
        function handleSubmit() {
          // Form handling
        }
      </script>
      <input type="text" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

**After:**
```tsx
import { CSPScript } from '@elevate/security/csp-hooks';

function ContactForm() {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Form handling
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Analytics Components

**Before:**
```tsx
function Analytics() {
  useEffect(() => {
    const script = document.createElement('script');
    script.innerHTML = `
      gtag('config', 'GA_TRACKING_ID');
    `;
    document.head.appendChild(script);
  }, []);
}
```

**After:**
```tsx
import { CSPScript } from '@elevate/security/csp-hooks';

function Analytics() {
  return (
    <CSPScript>
      {`gtag('config', 'GA_TRACKING_ID');`}
    </CSPScript>
  );
}
```

### Third-Party Widgets

**Before:**
```tsx
function ChatWidget() {
  useEffect(() => {
    // Direct script injection
    const script = document.createElement('script');
    script.src = 'https://widget.example.com/chat.js';
    document.head.appendChild(script);
  }, []);
}
```

**After:**
```tsx
import { useCSPNonce } from '@elevate/security/csp-hooks';

function ChatWidget() {
  const nonce = useCSPNonce();
  
  useEffect(() => {
    if (!nonce) return;
    
    const script = document.createElement('script');
    script.src = 'https://widget.example.com/chat.js';
    script.nonce = nonce;
    document.head.appendChild(script);
  }, [nonce]);
}
```

Don't forget to add the domain to CSP config:
```typescript
allowedDomains: {
  external: ['https://widget.example.com']
}
```

## Testing Checklist

### Functional Testing

- [ ] **Authentication Flow**
  - [ ] Sign up works
  - [ ] Sign in works
  - [ ] Sign out works
  - [ ] Clerk components render correctly

- [ ] **File Operations**
  - [ ] File uploads to Supabase work
  - [ ] Image display works
  - [ ] File downloads work

- [ ] **Forms and Interactions**
  - [ ] All forms submit correctly
  - [ ] Validation messages display
  - [ ] Dynamic content loads
  - [ ] Modals and overlays work

- [ ] **Admin Functions**
  - [ ] Admin panel loads
  - [ ] Bulk operations work
  - [ ] Data exports work
  - [ ] User management functions

### Security Testing

- [ ] **CSP Violations**
  - [ ] No violations in browser console
  - [ ] Violation reporting works
  - [ ] All external resources allowed

- [ ] **Headers Validation**
  - [ ] CSP header present and correct
  - [ ] HSTS enabled in production
  - [ ] X-Frame-Options set to DENY
  - [ ] Other security headers present

### Performance Testing

- [ ] **Page Load Times**
  - [ ] No significant performance degradation
  - [ ] Scripts load in correct order
  - [ ] Styles apply correctly

## Monitoring and Maintenance

### CSP Violation Monitoring

1. **Set up alerts** for high-severity violations:
   ```typescript
   onViolation: (violation) => {
     if (violation.severity === 'high') {
       // Send alert to monitoring service
       await sendAlert(`CSP Violation: ${violation['violated-directive']}`);
     }
   }
   ```

2. **Regular violation review**:
   - Weekly review of CSP violations
   - Identify patterns in blocked resources
   - Update policies as needed

3. **Dashboard for violation tracking**:
   - Count violations by type
   - Track trends over time
   - Identify problematic pages

### Policy Updates

1. **Adding new external resources**:
   ```typescript
   // Update middleware configuration
   allowedDomains: {
     external: [...existing, 'https://new-service.com']
   }
   ```

2. **Testing policy changes**:
   - Always test in development first
   - Use staging environment for validation
   - Deploy to production during low-traffic periods

3. **Version control**:
   - Document all CSP policy changes
   - Include rationale in commit messages
   - Review changes in pull requests

## Common Issues and Solutions

### Issue: Clerk Authentication Broken

**Symptoms**: Login/signup forms don't work, authentication redirects fail

**Solution**: Ensure Clerk domains are included:
```typescript
allowedDomains: {
  clerk: [
    'https://clerk.dev',
    'https://*.clerk.dev',
    'https://images.clerk.dev',
    'https://img.clerk.com'
  ]
}
```

### Issue: Supabase File Uploads Fail

**Symptoms**: File uploads don't work, images don't display

**Solution**: Check Supabase domains and CORS settings:
```typescript
allowedDomains: {
  supabase: ['https://*.supabase.co', 'https://*.supabase.in']
}
```

### Issue: Third-Party Scripts Blocked

**Symptoms**: Analytics, chat widgets, or other third-party scripts don't load

**Solution**: Add domains to external list and use proper nonce:
```typescript
allowedDomains: {
  external: ['https://third-party-service.com']
}
```

### Issue: Dynamic Content Generation Broken

**Symptoms**: Dynamically created scripts or styles don't work

**Solution**: Use CSP-compliant methods:
```typescript
import { executeWithNonce } from '@elevate/security/csp-hooks';

// Instead of creating script elements directly
await executeWithNonce(scriptContent);
```

## Rollback Plan

### If Issues Occur in Production

1. **Immediate Steps**:
   - Set CSP to report-only mode:
     ```typescript
     const emergencyConfig = { ...config, reportOnly: true };
     ```
   - Deploy hotfix immediately

2. **Investigation**:
   - Collect CSP violation reports
   - Identify root cause
   - Test fixes in development

3. **Recovery**:
   - Fix identified issues
   - Test in staging
   - Redeploy with proper CSP enforcement

### Emergency Configuration

Keep this configuration ready for emergencies:

```typescript
// Emergency CSP config - very permissive
const emergencyConfig = {
  reportOnly: true,
  allowedDomains: {
    external: ['*'] // Allow all external domains
  }
};
```

## Support and Resources

### Documentation
- [README.md](./README.md) - Complete API documentation
- [CSP Specification](https://www.w3.org/TR/CSP3/) - Official CSP spec
- [MDN CSP Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) - MDN documentation

### Tools
- Browser DevTools - Console for CSP violations
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/) - Google's CSP analyzer
- [Report URI](https://report-uri.com/) - CSP reporting service

### Troubleshooting
- Check browser console for CSP violations
- Review server logs for violation reports
- Use browser DevTools Network tab to see blocked requests
- Test with CSP disabled to isolate issues

## Post-Migration Tasks

### 1. Documentation Updates
- [ ] Update deployment documentation
- [ ] Document new CSP policies
- [ ] Update developer onboarding guide

### 2. Team Training
- [ ] Train team on CSP best practices
- [ ] Review React component patterns
- [ ] Set up development guidelines

### 3. Monitoring Setup
- [ ] Configure CSP violation alerts
- [ ] Set up automated security scanning
- [ ] Regular security policy reviews

### 4. Future Improvements
- [ ] Implement stricter policies over time
- [ ] Add additional security headers
- [ ] Consider implementing SRI (Subresource Integrity)
- [ ] Evaluate moving to CSP Level 3 features

This migration ensures the MS Elevate LEAPS Tracker has comprehensive security protection while maintaining full functionality.