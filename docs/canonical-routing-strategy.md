# Canonical Route Strategy Implementation

## Overview
This document outlines the canonical routing strategy implemented for the MS Elevate LEAPS Tracker to avoid SEO duplicates and ensure API consistency.

## Canonical Routes Established

### 1. Public Profile Routes
- **Canonical URL**: `/u/[handle]` 
- **Example**: `https://leaps.mereka.org/u/siti_nurhaliza`
- **Purpose**: Single, authoritative URL for all public educator profiles

### 2. API Routes (Internal Use Only)
- **URL**: `/api/profile/[handle]`
- **Purpose**: Internal data fetching only, not meant for direct access
- **Redirect**: Automatically redirects to canonical profile if accessed directly

### 3. LEAPS Metrics (Public)
- **Canonical paths**:
  - `/metrics/learn`
  - `/metrics/explore`
  - `/metrics/amplify`
  - `/metrics/present`
  - `/metrics/shine`
- **Notes**:
  - Learn uses Option B counters (no form); stage cards and nav link here.
  - Locale prefix applies (e.g., `/{locale}/metrics/learn`).

### 4. Onboarding (Post Sign-up)
- **Canonical path**: `/{locale}/onboarding/user-type`
- **Notes**:
  - New users default to STUDENT until they select a role here.
  - Educators must provide School (autocomplete) and Region.

### 5. Webhooks & Admin APIs
- **Webhooks**:
  - `POST /api/kajabi/webhook` (Kajabi Learn tags; signature required in prod)
  - `POST /api/webhooks/clerk` (Clerk user created/updated; Svix verified)
- **Admin**:
  - `POST /api/admin/kajabi/invite` (Enroll contact; offer grant; v1 fallback)

### 6. Account (Clerk User Profile)
- **Canonical path**: `/{locale}/account`
- **Notes**:
  - Renders Clerk’s `UserProfile` for account management (sign-in methods, password, connected accounts, profile image).
  - LEAPS role and school/region remain managed via onboarding/profile pages; Clerk user profile does not modify `user_type`.

## Redirects Implemented

### Permanent Redirects (308 Status)
All legacy profile route patterns redirect to the canonical format:

```javascript
// In next.config.mjs
redirects: [
  { source: '/profile/:handle', destination: '/u/:handle', permanent: true },
  { source: '/user/:handle', destination: '/u/:handle', permanent: true },
  { source: '/profiles/:handle', destination: '/u/:handle', permanent: true },
  { source: '/api/profile/:handle', destination: '/u/:handle', permanent: true }
]
```

## SEO Optimization Features

### 1. Canonical Meta Tags
Every profile page includes canonical URL meta tags:
```typescript
{
  alternates: {
    canonical: 'https://leaps.mereka.org/u/[handle]'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true }
  }
}
```

### 2. Sitemap Generation
- **File**: `/app/sitemap.ts` (Next.js 15 format)
- **Content**: All public profiles with canonical URLs
- **Frequency**: Profile pages set to `weekly` changeFreq
- **Priority**: Profile pages at 0.8 priority

### 3. Robots.txt
- **Location**: `/public/robots.txt`
- **Features**:
  - Allows canonical routes (`/u/`)
  - Disallows legacy routes (`/profile/`, `/user/`, `/profiles/`)
  - References sitemap location
  - Sets crawl delay for politeness

## Utility Functions

### Canonical URL Helpers
Location: `/packages/types/src/canonical-urls.ts`

```typescript
// Get canonical profile path (relative)
getProfilePath(handle: string): string

// Get canonical profile URL (absolute) 
getProfileUrl(handle: string): string

// Validate canonical format
isCanonicalProfileUrl(url: string): boolean

// Extract handle from canonical URL
extractHandleFromUrl(url: string): string | null
```

## Code Updates Made

### 1. Component Updates
- **ProfileCard**: Uses `getProfilePath()` helper
- **LeaderboardTable**: Uses `getProfilePath()` helper  
- **Dashboard**: Uses `getProfilePath()` helper
- **Profile Page**: Uses `getProfileUrl()` for metadata

### 2. Configuration Updates
- **next.config.mjs**: Added permanent redirects
- **middleware.ts**: Added clarifying comment for canonical routes
- **sitemap.ts**: Uses canonical URL helpers

### 3. API Documentation
- **API Route**: Added clear documentation that `/api/profile/[handle]` is internal only

## Benefits Achieved

### 1. SEO Benefits
- ✅ Single canonical URL per profile prevents duplicate content
- ✅ Proper canonical meta tags signal authority to search engines
- ✅ Comprehensive sitemap helps with indexing
- ✅ Robots.txt guides crawler behavior

### 2. User Experience
- ✅ Consistent URLs across the application
- ✅ Permanent redirects preserve bookmarks and shared links
- ✅ Clean, memorable URL format (`/u/handle`)

### 3. Developer Experience  
- ✅ Utility functions prevent URL inconsistencies
- ✅ Centralized URL generation logic
- ✅ Clear documentation of routing strategy
- ✅ TypeScript support for URL validation

## Testing Recommendations

### 1. Redirect Testing
Test that legacy routes properly redirect:
```bash
curl -I https://leaps.mereka.org/profile/test_user
# Should return 308 redirect to /u/test_user
```

### 2. SEO Testing
- Verify canonical tags are present in HTML
- Check sitemap accessibility at `/sitemap.xml`
- Validate robots.txt at `/robots.txt`

### 3. Link Consistency
- Audit all internal links use canonical format
- Verify social sharing uses canonical URLs
- Check OpenGraph URLs are canonical

## Future Considerations

### 1. Internationalization
- Canonical URLs work with `next-intl` locale routing
- Consider locale-specific sitemaps if needed

### 2. Performance
- Sitemap cached for 1 hour with stale-while-revalidate
- Consider static generation for high-traffic profiles

### 3. Analytics
- Track redirect usage to identify popular legacy patterns
- Monitor canonical URL adoption in external links

## Migration Notes

### Breaking Changes
- None - all changes are backwards compatible via redirects

### Legacy Support  
- All old URLs continue to work via 308 redirects
- External links and bookmarks remain functional
- Social media shares redirect to canonical URLs

---

*This strategy ensures optimal SEO performance while maintaining backwards compatibility and providing a clean, consistent URL structure for the MS Elevate LEAPS Tracker platform.*
