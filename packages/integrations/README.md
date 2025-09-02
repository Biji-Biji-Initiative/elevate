# @elevate/integrations

Integration utilities for external services used by the MS Elevate LEAPS Tracker.

## Overview

This package provides typed clients and utilities for integrating with external services:

- **Kajabi**: Learning management platform integration for user enrollment and course completion tracking

## Kajabi Integration

### Setup

Add the following environment variables:

```bash
KAJABI_API_KEY=your-api-key
KAJABI_CLIENT_SECRET=your-client-secret
```

### Usage

```typescript
import { getKajabiClient, enrollUserInKajabi, isKajabiHealthy } from '@elevate/integrations';

// Basic client usage
const client = getKajabiClient();
const contact = await client.createOrUpdateContact('user@example.com', 'John Doe');

// High-level utility functions
const result = await enrollUserInKajabi('user@example.com', 'John Doe', {
  offerId: 12345,
  tagId: 67890
});

// Health check
const isHealthy = await isKajabiHealthy();
```

### API Methods

#### KajabiClient

- `createOrUpdateContact(email, name)` - Create or update a contact
- `findContactByEmail(email)` - Find contact by email address
- `grantOffer(contactId, offerId)` - Grant an offer to a contact
- `tagContact(contactId, tagId)` - Add a tag to a contact
- `untagContact(contactId, tagId)` - Remove a tag from a contact
- `getContactTags(contactId)` - Get all tags for a contact
- `healthCheck()` - Test API connectivity

#### Utility Functions

- `enrollUserInKajabi(email, name, options)` - Complete user enrollment workflow
- `isKajabiHealthy()` - Check if API is accessible
- `tryGetKajabiClient()` - Safe client getter that doesn't throw

### Error Handling

All methods throw descriptive errors for API failures. The utility functions provide a more user-friendly interface with success/error results.

### Webhook Integration

The Kajabi webhook handler processes `contact.tagged` events to automatically award LEARN points when the `LEARN_COMPLETED` tag is applied to a user.

## Development

### Adding New Integrations

1. Create a new client file (e.g., `src/newservice.ts`)
2. Export from `src/index.ts`
3. Add environment variables to `.env.example` files
4. Update this README

### Testing

```bash
# Run type checking
pnpm type-check

# Test in development environment
pnpm dev
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `KAJABI_API_KEY` | Kajabi API key | Yes |
| `KAJABI_CLIENT_SECRET` | Kajabi client secret | Yes |

## Types

The package exports TypeScript interfaces for all API responses and request payloads to ensure type safety throughout the application.