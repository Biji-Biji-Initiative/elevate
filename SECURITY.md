# Security Documentation - MS Elevate LEAPS Tracker

## Overview

This document outlines the comprehensive security measures implemented in the MS Elevate LEAPS Tracker platform to protect against common web vulnerabilities and ensure data integrity for Microsoft-sponsored educator programs.

## Security Architecture

### Defense in Depth Strategy

Our security implementation follows a multi-layered approach:

1. **Network Security**: HTTPS enforcement, secure headers, CSP
2. **Application Security**: CSRF protection, input sanitization, rate limiting
3. **Data Security**: Encrypted storage, secure file handling, access controls
4. **Authentication Security**: Clerk-based OAuth, role-based access control
5. **Infrastructure Security**: Supabase RLS, Vercel security headers

## Implemented Security Measures

### 1. CSRF (Cross-Site Request Forgery) Protection ✅

**Location**: `packages/security/src/csrf.ts`

**Implementation**:
- Double-submit cookie pattern for all state-changing operations
- Cryptographically secure token generation using `crypto.randomBytes()`
- Timing-safe token comparison to prevent timing attacks
- Automatic token rotation (1-hour expiration)

**Protected Endpoints**:
- `/api/submissions` (POST, PUT, PATCH, DELETE)
- `/api/files/upload` (POST)
- `/api/admin/*` (all state-changing methods)

**Usage**:
```typescript
import { withCSRFProtection } from '@elevate/security/csrf';

export const POST = withCSRFProtection(async (request) => {
  // Your protected endpoint logic
});
```

### 2. Content Security Policy (CSP) ✅

**Location**: `packages/security/src/csp.ts`

**Features**:
- Strict CSP with nonce-based script execution
- Comprehensive domain allowlists for trusted services
- CSP violation reporting endpoint
- Environment-specific configurations (dev/staging/production)

**Protected Against**:
- XSS attacks via script injection
- Clickjacking attacks
- Data injection attacks
- Unwanted resource loading

**Trusted Domains**:
- Clerk: `*.clerk.dev`, `*.clerk.com`
- Supabase: `*.supabase.co`, `*.supabase.in`
- Fonts: `fonts.googleapis.com`, `fonts.gstatic.com`
- Analytics: `vitals.vercel-analytics.com`

### 3. Content Sanitization ✅

**Location**: `packages/security/src/sanitizer.ts`

**Features**:
- HTML entity escaping to prevent XSS
- Content length validation
- URL sanitization and validation
- Activity-specific payload sanitization
- Batch sanitization utilities

**Content Limits**:
- Short text (names, titles): 255 characters
- Medium text (reflections): 1,000 characters  
- Long text (detailed descriptions): 5,000 characters
- URLs: 2,048 characters
- Email addresses: 254 characters

**Sanitization Rules**:
```typescript
// Learn activity
sanitizeSubmissionPayload('LEARN', {
  certificateTitle: "User Input <script>alert('xss')</script>",
  completionDate: "2024-01-15"
});
// Returns: { certificateTitle: "User Input &lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;", completionDate: "2024-01-15" }
```

### 4. Rate Limiting ✅

**Location**: `packages/security/src/rate-limiter.ts`

**Implementation**:
- Redis-backed (Upstash) with in-memory fallback
- IP + User-Agent based identification
- Configurable rate limits per endpoint type
- Rate limit headers in responses

**Rate Limits**:
- File uploads: 10 requests/minute
- Submissions: 20 requests/minute
- Admin actions: 40 requests/minute
- Public API: 100 requests/minute
- Webhooks: 120 requests/minute

### 5. File Upload Security ✅

**Location**: `packages/storage/src/index.ts`

**Security Controls**:
- File type validation (PDF, JPG, PNG only)
- File size limits (10MB maximum)
- Content hash generation for deduplication
- User-segregated storage paths
- Signed URL access with expiration (1 hour TTL)

**Storage Structure**:
```
evidence/{userId}/{activityCode}/{timestamp}-{hash}.{ext}
```

**Supabase Bucket Policies**:
- Private bucket with authenticated access only
- Row-level security (RLS) enforcement
- Signed URLs prevent direct access

### 6. Security Headers ✅

**Location**: `apps/web/next.config.mjs`

**Headers Implemented**:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload (production only)
```

### 7. Dependency Security ✅

**Security Audit Status**: ✅ No known vulnerabilities

**Fixed Vulnerabilities**:
- **esbuild**: Updated to >=0.25.0 (fixed GHSA-67mh-4wv8-2f99)
- **prismjs**: Updated to >=1.30.0 (fixed GHSA-x7hr-w5r2-h6wg)

**Automated Scanning**:
```bash
pnpm audit --audit-level moderate
```

## Security Testing

### 1. CSRF Protection Test

```bash
# Test CSRF protection
curl -X POST https://leaps.mereka.org/api/submissions \
  -H "Content-Type: application/json" \
  -d '{"activityCode": "LEARN", "payload": {}}' \
# Expected: 403 Forbidden with CSRF error
```

### 2. Content Sanitization Test

```typescript
// Test XSS prevention
const maliciousInput = "<script>alert('xss')</script>";
const sanitized = sanitizeText(maliciousInput);
// Expected: "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
```

### 3. File Upload Security Test

```bash
# Test file type validation
curl -X POST https://leaps.mereka.org/api/files/upload \
  -F "file=@malicious.exe" \
  -F "activityCode=EXPLORE" \
  -H "Authorization: Bearer $CLERK_TOKEN"
# Expected: 400 Bad Request with file type error
```

### 4. Rate Limiting Test

```bash
# Test rate limiting
for i in {1..15}; do
  curl -X POST https://leaps.mereka.org/api/files/upload \
    -F "file=@test.pdf" \
    -F "activityCode=EXPLORE" \
    -H "Authorization: Bearer $CLERK_TOKEN"
done
# Expected: 429 Too Many Requests after 10 requests
```

## Vulnerability Assessments

### Prevented Attack Vectors

✅ **Cross-Site Scripting (XSS)**
- Content sanitization
- CSP with strict script sources
- HTML entity escaping

✅ **Cross-Site Request Forgery (CSRF)**  
- Double-submit cookie tokens
- SameSite cookie attributes
- Origin validation

✅ **Clickjacking**
- X-Frame-Options: DENY
- CSP frame-ancestors 'none'

✅ **File Upload Attacks**
- File type validation
- Size limits
- Content hash verification
- Isolated storage

✅ **Injection Attacks**
- Parameterized queries (Prisma)
- Input validation/sanitization
- Content type validation

✅ **Denial of Service (DoS)**
- Rate limiting per endpoint
- Request size limits
- Connection timeouts

### Security Monitoring

**CSP Violation Reporting**:
- Endpoint: `/api/csp-report`
- Real-time violation logging
- Severity classification
- Automated alerting for high-severity violations

**Rate Limit Monitoring**:
- Per-endpoint metrics
- Client IP tracking
- Automated blocking
- Alert on suspicious patterns

**Audit Logging**:
- All admin actions logged
- Authentication events tracked
- Data access patterns monitored
- Retention: 90 days minimum

## Configuration

### Environment Variables

**Required**:
```bash
# CSRF
CSRF_SECRET_KEY=your-secret-key-here

# Rate Limiting (optional)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
WEBHOOK_RATE_LIMIT_RPM=120
SUBMISSION_RATE_LIMIT_RPM=20
FILE_UPLOAD_RATE_LIMIT_RPM=10

# CSP Reporting (optional)
CSP_REPORT_URI=/api/csp-report
CSP_VIOLATION_ALERTS=true
```

**Development Settings**:
```bash
NODE_ENV=development
RATE_LIMIT_LOG_ENABLED=1
CSP_REPORT_ONLY=true
```

## Security Best Practices for Developers

### 1. Input Validation

Always sanitize user input:
```typescript
import { sanitizeText, sanitizeUrl } from '@elevate/security/sanitizer';

const userInput = sanitizeText(request.body.content, {
  maxLength: 1000,
  allowNewlines: true
});
```

### 2. API Route Protection

Protect state-changing endpoints:
```typescript
import { withCSRFProtection } from '@elevate/security/csrf';
import { submissionRateLimiter, withRateLimit } from '@elevate/security/rate-limiter';

export const POST = withCSRFProtection(async (request) => {
  return withRateLimit(request, submissionRateLimiter, async () => {
    // Your endpoint logic here
  });
});
```

### 3. File Handling

Validate all file uploads:
```typescript
import { validateFile, saveEvidenceFile } from '@elevate/storage';

// File validation happens automatically in saveEvidenceFile
const result = await saveEvidenceFile(file, userId, activityCode);
```

### 4. Content Output

Escape content in UI components:
```tsx
// Good: Next.js automatically escapes
<p>{userGeneratedContent}</p>

// Bad: Dangerous HTML injection
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

## Incident Response

### Security Incident Classification

**High Severity**:
- Data breach or unauthorized access
- XSS/CSRF attacks succeeding
- Authentication bypass
- File upload malware

**Medium Severity**:
- CSP violations (script-src, frame-ancestors)
- Rate limiting failures
- Suspicious user behavior patterns

**Low Severity**:
- Minor CSP violations (style-src, img-src)
- Failed authentication attempts
- Resource loading issues

### Response Procedures

1. **Immediate**: Block malicious IPs, revoke compromised tokens
2. **Investigation**: Review logs, identify attack vectors
3. **Containment**: Apply emergency patches, update security rules
4. **Recovery**: Restore services, verify data integrity
5. **Post-Incident**: Update security measures, document lessons learned

## Compliance

### Data Protection

- **GDPR Compliance**: Data minimization, consent management, right to deletion
- **Microsoft Standards**: Enterprise-grade security for education sector
- **Industry Standards**: OWASP Top 10 protection, secure development lifecycle

### Audit Requirements

- **Security Reviews**: Quarterly vulnerability assessments
- **Penetration Testing**: Annual third-party security testing
- **Compliance Audits**: Microsoft-sponsored education program requirements

## Security Roadmap

### Phase 2 Enhancements (Post-MVP)

🔄 **Advanced Rate Limiting**:
- Behavioral analysis
- Machine learning-based anomaly detection
- Distributed rate limiting

🔄 **Enhanced Monitoring**:
- Security Information and Event Management (SIEM)
- Real-time threat detection
- Automated incident response

🔄 **Additional Protections**:
- Web Application Firewall (WAF)
- Bot detection and mitigation
- Advanced file scanning (malware/virus)

🔄 **Zero Trust Architecture**:
- Micro-segmentation
- Continuous authentication
- Least privilege access

## Security Contacts

### Reporting Security Issues

**Internal**: security@elevate-platform.com
**External**: security-reports@microsoft.com

### Security Team

- **Security Lead**: [Name]
- **Platform Security**: [Name]  
- **Compliance Officer**: [Name]

---

**Document Version**: 1.0  
**Last Updated**: 2025-09-03  
**Next Review**: 2025-12-03

*This document is classified as **Internal Use** and should not be shared outside the development team without approval.*