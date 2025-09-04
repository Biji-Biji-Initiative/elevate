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
import { client } from '@elevate/openapi/sdk';

// Initialize the client with authentication
const apiClient = client({
  baseUrl: 'https://leaps.mereka.org',
  headers: {
    'Authorization': `Bearer ${clerkToken}`
  }
});

// Create a Learn submission
const { data } = await apiClient.POST('/api/submissions', {
  body: {
    activityCode: 'LEARN',
    payload: {
      provider: 'SPL',
      course: 'AI for Educators',
      completedAt: new Date().toISOString(),
      certificateFile: 'evidence/learn/user123/certificate.pdf'
    },
    visibility: 'PRIVATE'
  }
});

// Get leaderboard
const { data: leaderboard } = await apiClient.GET('/api/leaderboard', {
  params: {
    query: {
      period: '30d',
      limit: 10
    }
  }
});
```

### Using OpenAPI Types

```typescript
import type { paths } from '@elevate/openapi/client';

// Use path types for parameters and responses
type LeaderboardParams = paths['/api/leaderboard']['get']['parameters']['query'];
type LeaderboardResponse = paths['/api/leaderboard']['get']['responses']['200']['content']['application/json'];
```

### Error Handling

```typescript
// Error handling with openapi-fetch client
const { data, error } = await apiClient.POST('/api/submissions', {
  body: submissionData
});

if (error) {
  switch (error.status) {
    case 400:
      console.error('Validation error:', error.error);
      break;
    case 401:
      console.error('Authentication required');
      break;
    case 403:
      console.error('Insufficient permissions');
      break;
    default:
      console.error(`API Error ${error.status}:`, error.error);
  }
} else {
  console.log('Success:', data);
}
```

## Development

### Generating Documentation

```bash
# Generate all OpenAPI artifacts
pnpm run generate:all

# Or individual components
pnpm run generate          # OpenAPI spec
pnpm run generate:client   # TypeScript client types
pnpm run generate:sdk      # TypeScript SDK
```

### Development Mode

```bash
# Watch mode for automatic regeneration
pnpm run dev
```

### Build Process

```bash
# Clean build (recommended)
pnpm run clean && pnpm run build

# Development build
pnpm run build
```

### Scripts

| Script | Description |
|--------|-------------|
| `generate` | Generate OpenAPI spec from Zod schemas |
| `generate:client` | Generate TypeScript types from OpenAPI spec |
| `generate:sdk` | Generate TypeScript SDK with client methods |
| `generate:all` | Generate everything (spec + client + SDK) |
| `build` | Build the package for distribution |
| `build:types` | Generate TypeScript declaration files |
| `dev` | Watch mode for development |
| `clean` | Remove all generated files |
| `api:extract` | Run API Extractor for documentation |

## File Structure

```
packages/openapi/
├── src/
│   ├── schemas.ts          # Zod schemas with OpenAPI metadata
│   ├── spec.ts            # OpenAPI specification generator
│   ├── generator.ts       # Main generation script
│   ├── client-generator.ts # SDK generation script
│   ├── client.ts          # Generated TypeScript types
│   ├── sdk.ts             # Generated TypeScript SDK
│   └── index.ts           # Package exports
├── dist/
│   ├── openapi.json       # Generated OpenAPI spec
│   ├── js/                # Compiled JavaScript
│   └── types/             # TypeScript declarations
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
import { client } from '@elevate/openapi/sdk';

// Environment-specific base URLs
const apiClient = client({
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://leaps.mereka.org'
    : 'http://localhost:3000'
});
```

## Available Exports

This package provides the following exports:

| Export | Description |
|--------|-------------|
| `@elevate/openapi` | Main schemas, types, and spec |
| `@elevate/openapi/sdk` | TypeScript SDK client |
| `@elevate/openapi/client` | Generated TypeScript types |
| `@elevate/openapi/schemas` | Zod schemas with OpenAPI metadata |
| `@elevate/openapi/spec` | OpenAPI specification object |
| `@elevate/openapi/spec.json` | Raw OpenAPI JSON file |

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
    const apiClient = client({ baseUrl: '/api' });
    apiClient.GET('/api/submissions', {
      params: { query: { activity: activityCode } }
    })
      .then(({ data }) => setData(data))
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

For more detailed usage and implementation examples, refer to the source code in the `src/` directory and the comprehensive type definitions in the generated `dist/types/` files.