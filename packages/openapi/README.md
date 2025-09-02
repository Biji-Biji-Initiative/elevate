# @elevate/openapi

OpenAPI documentation and TypeScript client SDK for the MS Elevate LEAPS Tracker API.

## Overview

This package generates comprehensive OpenAPI documentation from Zod schemas and provides a type-safe TypeScript client for consuming the API. It includes:

- **OpenAPI 3.1 Specification** - Complete API documentation generated from Zod schemas
- **TypeScript Client SDK** - Type-safe API client with error handling
- **Swagger UI Integration** - Interactive API documentation
- **Code Generation** - Automated regeneration of specs and clients

## Features

### OpenAPI Specification
- ✅ All LEAPS activity endpoints (Learn, Explore, Amplify, Present, Shine)
- ✅ Authentication requirements (Clerk JWT)
- ✅ Response schemas with examples
- ✅ Error handling documentation
- ✅ Rate limiting information
- ✅ Webhook documentation

### TypeScript SDK
- ✅ Type-safe API client class
- ✅ Automatic request/response typing
- ✅ Custom error classes with status codes
- ✅ File upload support
- ✅ Environment configuration
- ✅ React hooks examples

## Installation

The package is automatically available in the monorepo workspace:

```bash
# In web app package.json
"@elevate/openapi": "workspace:*"
```

## Usage

### Viewing API Documentation

The interactive Swagger UI is available at:
- Development: http://localhost:3000/docs
- Production: https://leaps.mereka.org/docs

### Using the TypeScript SDK

```typescript
import ElevateAPIClient from '@elevate/openapi/sdk';

// Initialize the client
const api = new ElevateAPIClient({
  baseUrl: 'https://leaps.mereka.org',
  token: 'your-clerk-jwt-token'
});

// Create a Learn submission
const submission = await api.createSubmission({
  activityCode: 'LEARN',
  payload: {
    provider: 'SPL',
    course: 'AI for Educators',
    completedAt: new Date().toISOString(),
    certificateFile: 'evidence/learn/user123/certificate.pdf'
  },
  visibility: 'PRIVATE'
});

// Get leaderboard
const leaderboard = await api.getLeaderboard({
  period: '30d',
  limit: 10
});

// Upload files
const upload = await api.uploadFile(file, 'EXPLORE');
```

### Error Handling

```typescript
import { APIError, ValidationError, AuthenticationError } from '@elevate/openapi/sdk';

try {
  await api.createSubmission(data);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation errors:', error.details);
  } else if (error instanceof AuthenticationError) {
    console.error('Authentication required');
  } else if (error instanceof APIError) {
    console.error(`API Error ${error.status}:`, error.message);
  }
}
```

## Development

### Generating Documentation

```bash
# Generate all OpenAPI artifacts
pnpm openapi:generate

# Or individual components
pnpm -F @elevate/openapi generate        # OpenAPI spec
pnpm -F @elevate/openapi generate:sdk    # TypeScript SDK
```

### Development Mode

```bash
# Watch mode for automatic regeneration
pnpm openapi:dev
```

### Scripts

| Script | Description |
|--------|-------------|
| `generate` | Generate OpenAPI spec and TypeScript types |
| `generate:sdk` | Generate TypeScript SDK with examples |
| `generate:all` | Generate everything (spec + SDK) |
| `build` | Build the package for distribution |
| `dev` | Watch mode for development |
| `clean` | Remove generated files |

## File Structure

```
packages/openapi/
├── src/
│   ├── schemas.ts          # Zod schemas with OpenAPI metadata
│   ├── spec.ts            # OpenAPI specification generator
│   ├── generator.ts       # Main generation script
│   ├── client-generator.ts # SDK generation script
│   └── index.ts           # Package exports
├── dist/
│   ├── openapi.json       # Generated OpenAPI spec
│   ├── client.ts          # Generated TypeScript types
│   ├── sdk.ts             # Generated TypeScript SDK
│   └── examples.ts        # Usage examples
├── package.json
└── README.md
```

## API Endpoints Covered

### Public Endpoints
- `GET /api/leaderboard` - Public leaderboard with pagination
- `GET /api/health` - Health check
- `POST /api/kajabi/webhook` - Kajabi course completion webhook

### Authenticated Endpoints
- `POST /api/submissions` - Create LEAPS activity submission
- `GET /api/submissions` - Get user submissions
- `POST /api/files/upload` - Upload evidence files
- `GET /api/dashboard` - Get user dashboard data

### Admin Endpoints
- `GET /api/admin/submissions` - Review queue for admins

## LEAPS Activity Schemas

Each LEAPS activity has its own schema definition:

### Learn
- Provider (SPL/ILS)
- Course name
- Completion date
- Certificate file

### Explore
- Reflection text (min 150 chars)
- Class date
- School (optional)
- Evidence files

### Amplify
- Peers trained (0-50)
- Students trained (0-200)
- Attendance proof files

### Present
- LinkedIn URL
- Screenshot file
- Caption

### Shine
- Idea title
- Idea summary
- Attachment files

## Environment Configuration

The SDK supports multiple environments:

```typescript
import { createApiClient } from '@elevate/openapi/sdk';

const api = createApiClient('production');  // or 'staging', 'development'
```

## Error Types

| Error Class | Status | Description |
|-------------|--------|-------------|
| `ValidationError` | 400 | Invalid request data |
| `AuthenticationError` | 401 | Missing/invalid token |
| `ForbiddenError` | 403 | Insufficient permissions |
| `RateLimitError` | 429 | Rate limit exceeded |
| `APIError` | Various | Base error class |

## Integration

### Web App Integration

The web app includes Swagger UI at `/docs` and serves the OpenAPI spec at `/api/docs`.

### Client Usage

```typescript
// React hook example
function useSubmissions(activityCode?: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.getSubmissions({ activity: activityCode })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activityCode]);
  
  return { data, loading };
}
```

## Contributing

When adding new API endpoints:

1. **Update schemas** in `src/schemas.ts`
2. **Add endpoint definitions** in `src/spec.ts`
3. **Add client methods** in `src/client-generator.ts`
4. **Regenerate** with `pnpm openapi:generate`
5. **Update documentation** as needed

## Validation

All schemas use Zod for runtime validation with OpenAPI metadata:

```typescript
const MySchema = z.object({
  field: z.string().min(1).openapi({
    description: 'Required field',
    example: 'example value'
  })
}).openapi({
  title: 'My Schema',
  description: 'Schema description'
});
```

## Caching

- OpenAPI spec: 1 hour cache
- Leaderboard data: 5-10 minutes cache
- Client requests: No automatic caching

## Security

- JWT token authentication via Clerk
- CORS configuration for API endpoints
- Rate limiting on submissions
- File upload validation

## Monitoring

The generated SDK includes request/response logging and error tracking integration points for Sentry or similar monitoring tools.

---

For more examples and detailed usage, see `dist/examples.ts` after running the generator.