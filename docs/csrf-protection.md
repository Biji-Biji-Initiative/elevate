# CSRF Protection System

## Overview

The MS Elevate LEAPS platform implements comprehensive Cross-Site Request Forgery (CSRF) protection to prevent unauthorized state-changing operations. This document outlines the CSRF protection system, its components, and usage patterns.

## Architecture

### Double-Submit Cookie Pattern

The system uses the **double-submit cookie pattern** for CSRF protection:

1. **Secret Cookie**: An `httpOnly`, `secure` cookie containing a random secret
2. **Token Header/Form Field**: A token sent in request headers or form data
3. **Validation**: Server validates that both values are present and properly formatted

### Components

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Client (React)    │    │   Server (Next.js)   │    │  Security Package   │
│                     │    │                      │    │                     │
│ useCSRFToken()      │◄──►│ /api/csrf-token      │◄──►│ CSRFManager         │
│ useCSRFProtectedForm│    │ middleware.ts        │    │ generateCSRFToken() │
│ CSRFProtectedForm   │    │ API routes           │    │ validateRequest()   │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
```

## Implementation Details

### Server-Side Components

#### 1. CSRFManager Class (`packages/security/src/csrf.ts`)

```typescript
const manager = new CSRFManager({
  cookieName: '_csrf',
  headerName: 'X-CSRF-Token', 
  tokenLength: 32,
  maxAge: 3600, // 1 hour
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax'
})
```

**Key Methods:**
- `generateToken()` - Creates cryptographically secure random token
- `generateTokenPair()` - Creates secret/token pair for double-submit pattern
- `validateRequest(request)` - Validates CSRF token from request
- `middleware()` - Returns middleware function for automatic protection

#### 2. Token Generation API (`apps/web/app/api/csrf-token/route.ts`)

```http
GET /api/csrf-token
Authorization: Bearer <clerk-jwt>

Response:
{
  "success": true,
  "data": {
    "token": "abc123...",
    "expiresAt": "2024-01-01T12:00:00Z"
  }
}
```

**Features:**
- Requires authentication (prevents anonymous token consumption)
- Sets `httpOnly` cookie with secret
- Returns token for client-side use
- Automatic expiration handling

#### 3. Middleware Protection (`apps/web/middleware.ts`)

```typescript
// Automatic protection for all state-changing API operations
const isProtectedApiRoute = createRouteMatcher([
  '/api/submissions',
  '/api/files/upload', 
  '/api/admin/(.*)'
])
```

**Protection Scope:**
- `POST`, `PUT`, `PATCH`, `DELETE` methods only
- Configurable route matching
- Integrates with Clerk authentication
- Returns standardized error responses

#### 4. API Route Protection

**Manual Protection:**
```typescript
import { withCSRFProtection } from '@elevate/security/csrf'

export const POST = withCSRFProtection(async (request) => {
  // Handler logic - CSRF already validated
})
```

**Automatic Protection (via middleware):**
```typescript
// No code changes needed - middleware handles validation
export const POST = async (request: NextRequest) => {
  // Handler logic
}
```

### Client-Side Components

#### 1. CSRF Token Hook (`packages/security/src/csrf-hooks.tsx`)

```typescript
function MyComponent() {
  const { token, loading, error, refreshToken } = useCSRFToken()
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  // Use token in API calls
}
```

**Features:**
- Automatic token fetching on mount
- Loading and error states
- Token refresh capability
- Caching and reuse across components

#### 2. Protected Fetch Hook

```typescript
function MyComponent() {
  const { csrfFetch, loading, error } = useCSRFProtectedFetch()
  
  const handleSubmit = async (data) => {
    const response = await csrfFetch('/api/submissions', {
      method: 'POST',
      body: JSON.stringify(data)
    })
    // Automatically includes CSRF headers
  }
}
```

**Features:**
- Automatic CSRF header injection
- Built-in retry logic for token expiration
- Error handling for CSRF failures
- Type-safe fetch wrapper

#### 3. Protected Form Hook

```typescript
function MyForm() {
  const { submit, isSubmitting, submitError } = useCSRFProtectedForm()
  
  const handleSubmit = async (data) => {
    const result = await submit('/api/submissions', data, {
      method: 'POST',
      onSuccess: (response) => console.log('Success!'),
      onError: (error) => console.error('Error:', error)
    })
  }
}
```

**Features:**
- Declarative form submission
- Built-in loading states
- Error handling and display
- Success/error callbacks

#### 4. Protected Form Component

```typescript
<CSRFProtectedForm 
  action="/api/submissions" 
  method="POST"
  onSuccess={(data) => handleSuccess(data)}
  showSecurityIndicator={true}
>
  <input name="title" required />
  <textarea name="content" required />
</CSRFProtectedForm>
```

**Features:**
- Drop-in replacement for regular forms
- Automatic CSRF token handling
- Security indicator for user awareness
- Error state management
- Loading states

## Security Features

### 1. Cryptographically Secure Tokens

```typescript
// Uses Node.js crypto.randomBytes() for token generation
const token = crypto.randomBytes(32).toString('hex')
```

### 2. Timing Attack Protection

```typescript
// Uses crypto.timingSafeEqual for token comparison
return crypto.timingSafeEqual(
  Buffer.from(expected, 'hex'),
  Buffer.from(actual, 'hex')
)
```

### 3. Token Expiration

- Default: 1 hour expiration
- Configurable per use case
- Automatic refresh on expiration
- Cookie-based expiration handling

### 4. Secure Cookie Configuration

```typescript
{
  httpOnly: true,        // Prevents XSS access
  secure: production,    // HTTPS only in production
  sameSite: 'lax',      // CSRF protection
  maxAge: 3600,         // 1 hour expiration
  path: '/'             // Site-wide availability
}
```

### 5. Method-Based Protection

- `GET`, `HEAD`, `OPTIONS` - No protection (idempotent)
- `POST`, `PUT`, `PATCH`, `DELETE` - Full protection
- Configurable method exclusions

## Error Handling

### Server-Side Errors

```json
{
  "success": false,
  "error": "CSRF token validation failed",
  "code": "CSRF_INVALID"
}
```

**Error Codes:**
- `CSRF_INVALID` - Token validation failed
- `CSRF_MISSING` - No token provided
- `CSRF_EXPIRED` - Token expired
- `CSRF_GENERATION_FAILED` - Server error during token generation

### Client-Side Error Handling

```typescript
const { error, refreshToken } = useCSRFToken()

// Handle different error types
if (error?.includes('CSRF_INVALID')) {
  refreshToken() // Automatic retry
} else if (error?.includes('network')) {
  // Handle network errors
} else {
  // Handle other errors
}
```

## Testing

### Unit Tests (`packages/security/src/__tests__/csrf.test.ts`)

**Test Coverage:**
- Token generation and validation
- Request validation logic
- Middleware behavior
- Error conditions
- Edge cases

**Running Tests:**
```bash
pnpm test csrf
```

### Integration Tests

**Test Scenarios:**
1. **Valid Request Flow**
   - Fetch token from `/api/csrf-token`
   - Submit form with token in header
   - Verify successful processing

2. **Invalid Token Scenarios**
   - Missing token → 403 response
   - Invalid token → 403 response
   - Expired token → 403 response with refresh prompt

3. **Method-Based Protection**
   - GET requests pass without tokens
   - POST requests require valid tokens

**Example Integration Test:**
```typescript
describe('CSRF Integration', () => {
  it('should protect form submissions', async () => {
    // 1. Get CSRF token
    const tokenResponse = await fetch('/api/csrf-token')
    const { token } = await tokenResponse.json()
    
    // 2. Submit form with token
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: 'test' })
    })
    
    expect(response.status).toBe(200)
  })
})
```

## Configuration

### Environment Variables

```env
# Optional: Override default settings
CSRF_TOKEN_LENGTH=32
CSRF_MAX_AGE=3600
CSRF_COOKIE_NAME=_csrf
CSRF_HEADER_NAME=X-CSRF-Token
```

### Custom Configuration

```typescript
const customCSRF = new CSRFManager({
  tokenLength: 64,        // Longer tokens
  maxAge: 7200,          // 2 hour expiration  
  secure: true,          // Always secure
  sameSite: 'strict',    // Stricter policy
  ignoreMethods: ['GET'] // Only ignore GET
})
```

## Migration Guide

### Existing Forms

**Before:**
```typescript
const handleSubmit = async (data) => {
  const response = await fetch('/api/submissions', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}
```

**After:**
```typescript
import { useCSRFProtectedFetch } from '@elevate/security/csrf-hooks'

function MyComponent() {
  const { csrfFetch } = useCSRFProtectedFetch()
  
  const handleSubmit = async (data) => {
    const response = await csrfFetch('/api/submissions', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
}
```

### API Routes

**Before:**
```typescript
export const POST = async (request: NextRequest) => {
  // Handler logic
}
```

**After (Manual Protection):**
```typescript
import { withCSRFProtection } from '@elevate/security/csrf'

export const POST = withCSRFProtection(async (request: NextRequest) => {
  // Handler logic - CSRF validated automatically
})
```

**After (Middleware Protection - Recommended):**
```typescript
// No code changes needed if route is in middleware matcher
export const POST = async (request: NextRequest) => {
  // Handler logic - middleware handles CSRF validation
}
```

## Best Practices

### 1. Use Middleware Protection

✅ **Recommended:** Configure middleware to protect routes automatically
```typescript
const isProtectedApiRoute = createRouteMatcher([
  '/api/submissions',
  '/api/admin/(.*)'
])
```

❌ **Avoid:** Manual protection for every route (error-prone)

### 2. Centralized Token Management

✅ **Recommended:** Use provided hooks for token management
```typescript
const { csrfFetch } = useCSRFProtectedFetch()
```

❌ **Avoid:** Manual token handling and header management

### 3. Graceful Degradation

✅ **Recommended:** Handle token loading and error states
```typescript
if (tokenLoading) return <Spinner />
if (tokenError) return <ErrorMessage />
```

❌ **Avoid:** Blocking UI without feedback

### 4. Security-First Defaults

✅ **Recommended:** Use secure defaults for production
```typescript
secure: process.env.NODE_ENV === 'production'
sameSite: 'lax'
httpOnly: true
```

❌ **Avoid:** Relaxed security settings in production

## Troubleshooting

### Common Issues

#### 1. "CSRF token validation failed"

**Causes:**
- Token expired (>1 hour old)
- Cookie not sent (SameSite issues)
- Token not included in request

**Solutions:**
- Check cookie settings (`secure`, `sameSite`)
- Verify token is included in request headers
- Call `refreshToken()` to get new token

#### 2. "Security verification failed"

**Causes:**
- Network error during token fetch
- Authentication required but user not logged in
- Server configuration error

**Solutions:**
- Check network connectivity
- Verify user is authenticated
- Check server logs for errors

#### 3. Form submissions not working

**Causes:**
- Missing CSRF token in form
- Using wrong content-type header
- Token not properly extracted

**Solutions:**
- Use `CSRFProtectedForm` component
- Ensure `Content-Type: application/json`
- Check browser network tab for headers

### Debugging

#### Enable Debug Logging

```typescript
// In development, log CSRF validation
const isValid = await csrfManager.validateRequest(request)
if (!isValid && process.env.NODE_ENV === 'development') {
  console.debug('CSRF Validation Details:', {
    hasCookie: !!request.cookies.get('_csrf'),
    hasToken: !!(await csrfManager.getCsrfToken(request)),
    method: request.method
  })
}
```

#### Network Analysis

1. **Check Token Endpoint:**
   - Verify `/api/csrf-token` returns valid token
   - Confirm cookie is set in browser

2. **Check Request Headers:**
   - Verify `X-CSRF-Token` header is present
   - Confirm cookie is sent with requests

3. **Check Response Errors:**
   - Look for specific error codes
   - Check server logs for validation failures

## Performance Considerations

### 1. Token Caching

- Tokens cached in React state
- Single token per session
- Automatic refresh on expiration

### 2. Minimal Overhead

- Only protects state-changing methods
- Skip validation for safe methods (`GET`, `HEAD`, `OPTIONS`)
- Efficient validation algorithm

### 3. Memory Usage

- Tokens stored in browser memory (not localStorage)
- Server-side tokens not stored (stateless validation)
- Minimal memory footprint

## Security Audit Checklist

- [ ] All state-changing API routes protected
- [ ] Secure cookie configuration in production
- [ ] Token expiration properly configured
- [ ] Error messages don't leak sensitive information
- [ ] Tests cover security edge cases
- [ ] Middleware properly configured
- [ ] Client-side token storage secure
- [ ] Network requests use HTTPS in production

## Future Enhancements

### 1. Advanced Token Rotation

- Implement token rotation on each request
- Reduce token lifetime for high-security operations
- Per-operation token scoping

### 2. Rate Limiting Integration

- Combine CSRF protection with rate limiting
- Detect and block CSRF attack patterns
- Enhanced monitoring and alerting

### 3. SameSite=Strict Support

- Option for stricter SameSite policy
- Enhanced cross-site protection
- Compatibility testing for embedded use cases

---

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Double Submit Cookie Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)
- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [MDN SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)