import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  ActivityCodeSchema,
  SubmissionStatusSchema,
  VisibilitySchema,
  LearnSchemaWithOpenApi,
  ExploreSchemaWithOpenApi,
  AmplifySchemaWithOpenApi,
  PresentSchemaWithOpenApi,
  ShineSchemaWithOpenApi,
  SubmissionRequestSchema,
  SubmissionResponseSchema,
  LeaderboardResponseSchema,
  FileUploadResponseSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
} from './schemas.js';

// Create OpenAPI registry
const registry = new OpenAPIRegistry();

// Register common schemas
registry.register('ActivityCode', ActivityCodeSchema);
registry.register('SubmissionStatus', SubmissionStatusSchema);
registry.register('Visibility', VisibilitySchema);
registry.register('LearnSubmission', LearnSchemaWithOpenApi);
registry.register('ExploreSubmission', ExploreSchemaWithOpenApi);
registry.register('AmplifySubmission', AmplifySchemaWithOpenApi);
registry.register('PresentSubmission', PresentSchemaWithOpenApi);
registry.register('ShineSubmission', ShineSchemaWithOpenApi);
registry.register('SubmissionRequest', SubmissionRequestSchema);
registry.register('SubmissionResponse', SubmissionResponseSchema);
registry.register('LeaderboardResponse', LeaderboardResponseSchema);
registry.register('FileUploadResponse', FileUploadResponseSchema);
registry.register('ErrorResponse', ErrorResponseSchema);
registry.register('SuccessResponse', SuccessResponseSchema);

// Security schemes
registry.registerComponent('securitySchemes', 'ClerkAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Clerk JWT token for authenticated requests',
});

// Register API endpoints

// Submissions endpoints
registry.registerPath({
  method: 'post',
  path: '/api/submissions',
  description: 'Create a new LEAPS activity submission',
  summary: 'Submit LEAPS Activity Evidence',
  tags: ['Submissions'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      description: 'Submission data',
      content: {
        'application/json': {
          schema: SubmissionRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Submission created successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: z.object({
              id: z.string().openapi({ example: 'sub_abc123' }),
              activityCode: ActivityCodeSchema,
              status: SubmissionStatusSchema,
              visibility: VisibilitySchema,
              createdAt: z.string().datetime().openapi({ example: '2024-01-15T10:00:00Z' }),
              potentialPoints: z.number().int().openapi({ example: 20 }),
            }),
          }).openapi({ title: 'Submission Creation Response' }),
        },
      },
    },
    400: {
      description: 'Invalid submission data or business rule violation',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - missing or invalid authentication',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    429: {
      description: 'Rate limit exceeded (e.g., Amplify 7-day limits)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/submissions',
  description: 'Get user submissions with optional filtering',
  summary: 'List User Submissions',
  tags: ['Submissions'],
  security: [{ ClerkAuth: [] }],
  request: {
    query: z.object({
      activity: ActivityCodeSchema.optional().openapi({
        description: 'Filter by activity code',
        example: 'LEARN',
      }),
      status: SubmissionStatusSchema.optional().openapi({
        description: 'Filter by submission status',
        example: 'APPROVED',
      }),
    }),
  },
  responses: {
    200: {
      description: 'User submissions retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: z.array(SubmissionResponseSchema),
          }).openapi({ title: 'Submissions List Response' }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// File upload endpoint
registry.registerPath({
  method: 'post',
  path: '/api/files/upload',
  description: 'Upload evidence files for LEAPS activities',
  summary: 'Upload Evidence File',
  tags: ['Files'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      description: 'File upload with activity context',
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.string().openapi({
              description: 'Evidence file (PDF, JPG, PNG, max 10MB)',
              format: 'binary',
            }),
            activityCode: ActivityCodeSchema.openapi({
              description: 'LEAPS activity code for file context',
            }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'File uploaded successfully',
      content: {
        'application/json': {
          schema: FileUploadResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid file or missing parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    413: {
      description: 'File too large (max 10MB)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// Leaderboard endpoint
registry.registerPath({
  method: 'get',
  path: '/api/leaderboard',
  description: 'Get public leaderboard data with pagination and search',
  summary: 'Get Leaderboard',
  tags: ['Public'],
  request: {
    query: z.object({
      period: z.enum(['all', '30d']).optional().openapi({
        description: 'Time period for leaderboard',
        example: 'all',
      }),
      limit: z.coerce.number().int().min(1).max(100).optional().openapi({
        description: 'Number of entries to return (1-100)',
        example: 20,
      }),
      offset: z.coerce.number().int().min(0).optional().openapi({
        description: 'Starting position for pagination',
        example: 0,
      }),
      search: z.string().optional().openapi({
        description: 'Search in user name, handle, or school',
        example: 'jakarta',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Leaderboard data retrieved successfully',
      content: {
        'application/json': {
          schema: LeaderboardResponseSchema,
        },
      },
      headers: {
        'Cache-Control': {
          description: 'Caching policy',
          schema: {
            type: 'string',
            example: 'public, s-maxage=600',
          },
        },
      },
    },
    400: {
      description: 'Invalid query parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// Dashboard endpoint
registry.registerPath({
  method: 'get',
  path: '/api/dashboard',
  description: 'Get user dashboard data including progress and recent submissions',
  summary: 'Get User Dashboard',
  tags: ['Dashboard'],
  security: [{ ClerkAuth: [] }],
  responses: {
    200: {
      description: 'Dashboard data retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: z.object({
              user: z.object({
                id: z.string().openapi({ example: 'user_123' }),
                name: z.string().openapi({ example: 'Ahmad Sutanto' }),
                handle: z.string().openapi({ example: 'educator_ahmad' }),
                email: z.string().email().openapi({ example: 'ahmad@school.edu' }),
                school: z.string().nullable().openapi({ example: 'SDN 123 Jakarta' }),
                cohort: z.string().nullable().openapi({ example: 'Cohort-2024-A' }),
                avatar_url: z.string().url().nullable().openapi({ 
                  example: 'https://images.clerk.dev/abc123' 
                }),
                profile_visibility: z.boolean().openapi({ 
                  example: false,
                  description: 'Whether profile is publicly visible' 
                }),
              }),
              progress: z.object({
                totalPoints: z.number().int().openapi({ example: 95 }),
                completedActivities: z.number().int().openapi({ example: 4 }),
                totalActivities: z.number().int().openapi({ example: 5 }),
                leaderboardRank: z.number().int().nullable().openapi({ example: 15 }),
              }),
              recentSubmissions: z.array(SubmissionResponseSchema),
              availableActivities: z.array(z.object({
                code: ActivityCodeSchema,
                name: z.string().openapi({ example: 'Learn' }),
                description: z.string().openapi({ 
                  example: 'Complete AI training and upload certificate' 
                }),
                default_points: z.number().int().openapi({ example: 20 }),
                hasSubmission: z.boolean().openapi({ example: true }),
                submissionStatus: SubmissionStatusSchema.nullable().openapi({ example: 'APPROVED' }),
              })),
            }),
          }).openapi({ title: 'Dashboard Response' }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// Health check endpoint
registry.registerPath({
  method: 'get',
  path: '/api/health',
  description: 'Health check endpoint for monitoring',
  summary: 'Health Check',
  tags: ['System'],
  responses: {
    200: {
      description: 'Service is healthy',
      content: {
        'application/json': {
          schema: z.object({
            status: z.string().openapi({ example: 'healthy' }),
            timestamp: z.string().datetime().openapi({ example: '2024-01-15T10:00:00Z' }),
            version: z.string().openapi({ example: '0.1.0' }),
          }).openapi({ title: 'Health Check Response' }),
        },
      },
    },
  },
});

// Webhooks
registry.registerPath({
  method: 'post',
  path: '/api/kajabi/webhook',
  description: 'Kajabi webhook for automatic Learn activity credit',
  summary: 'Kajabi Course Completion Webhook',
  tags: ['Webhooks'],
  security: [
    {
      WebhookSignature: [],
    },
  ],
  request: {
    body: {
      description: 'Kajabi webhook payload',
      content: {
        'application/json': {
          schema: z.object({
            event_type: z.string().openapi({ example: 'course_completion' }),
            user_email: z.string().email().openapi({ example: 'ahmad@school.edu' }),
            course_name: z.string().openapi({ example: 'AI for Educators' }),
            completed_at: z.string().datetime().openapi({ example: '2024-01-15T10:00:00Z' }),
            certificate_url: z.string().url().optional().openapi({ 
              example: 'https://kajabi.com/certificates/abc123' 
            }),
          }).openapi({ title: 'Kajabi Webhook Payload' }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Webhook processed successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            processed: z.boolean().openapi({ example: true }),
            user_matched: z.boolean().openapi({ example: true }),
          }).openapi({ title: 'Webhook Response' }),
        },
      },
    },
    400: {
      description: 'Invalid webhook payload',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid webhook signature',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// Admin endpoints (basic structure)
registry.registerPath({
  method: 'get',
  path: '/api/admin/submissions',
  description: 'Get submissions queue for review (admin only)',
  summary: 'Get Admin Submissions Queue',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    query: z.object({
      status: SubmissionStatusSchema.optional().openapi({
        description: 'Filter by submission status',
        example: 'PENDING',
      }),
      activity: ActivityCodeSchema.optional().openapi({
        description: 'Filter by activity code',
        example: 'LEARN',
      }),
      limit: z.coerce.number().int().min(1).max(100).optional().openapi({
        description: 'Number of entries to return',
        example: 50,
      }),
      offset: z.coerce.number().int().min(0).optional().openapi({
        description: 'Starting position for pagination',
        example: 0,
      }),
    }),
  },
  responses: {
    200: {
      description: 'Admin submissions retrieved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: z.array(z.object({
              id: z.string().openapi({ example: 'sub_abc123' }),
              user: z.object({
                name: z.string().openapi({ example: 'Ahmad Sutanto' }),
                handle: z.string().openapi({ example: 'educator_ahmad' }),
                email: z.string().email().openapi({ example: 'ahmad@school.edu' }),
              }),
              activity: z.object({
                code: ActivityCodeSchema,
                name: z.string().openapi({ example: 'Learn' }),
                default_points: z.number().int().openapi({ example: 20 }),
              }),
              status: SubmissionStatusSchema,
              createdAt: z.string().datetime().openapi({ example: '2024-01-15T10:00:00Z' }),
              attachmentCount: z.number().int().openapi({ example: 1 }),
            })),
            pagination: z.object({
              total: z.number().int().openapi({ example: 150 }),
              limit: z.number().int().openapi({ example: 50 }),
              offset: z.number().int().openapi({ example: 0 }),
              hasMore: z.boolean().openapi({ example: true }),
            }),
          }).openapi({ title: 'Admin Submissions Response' }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - insufficient permissions',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// Register webhook security scheme
registry.registerComponent('securitySchemes', 'WebhookSignature', {
  type: 'apiKey',
  in: 'header',
  name: 'X-Kajabi-Signature',
  description: 'Kajabi webhook signature for request verification',
});

// Generate OpenAPI specification
const generator = new OpenApiGeneratorV31(registry.definitions);

export const openApiSpec = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    version: '1.0.0',
    title: 'MS Elevate LEAPS Tracker API',
    description: `
# MS Elevate LEAPS Tracker API

This API powers the Microsoft Elevate Indonesia program, enabling educators to track their journey through the LEAPS framework (Learn, Explore, Amplify, Present, Shine).

## Authentication

Most endpoints require authentication via Clerk JWT tokens. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limiting

- General API endpoints: 100 requests per minute per user
- File uploads: 10 requests per minute per user  
- Amplify submissions: Special business rules apply (see endpoint documentation)

## File Uploads

Evidence files must be:
- Maximum size: 10MB
- Supported formats: PDF, JPG, PNG
- Uploaded via \`/api/files/upload\` before submission

## LEAPS Activities

### Learn (20 points)
Upload certificate from AI training course. Can be auto-credited via Kajabi webhook.

### Explore (50 points)  
Document classroom AI application with reflection and evidence photos/videos.

### Amplify (2 points/peer, 1 point/student)
Train other educators and students. Has 7-day rolling limits (max 50 peers, 200 students).

### Present (20 points)
Share experience on LinkedIn with screenshot proof.

### Shine (Recognition)
Submit innovative AI education ideas for recognition (no points in MVP).

## Error Handling

All endpoints return consistent error response format with appropriate HTTP status codes.

## Caching

- Leaderboard: Cached for 5-10 minutes
- Public profile data: Cached for 1 hour
- Static content: Long-term caching

## Support

For API support, contact the development team or refer to the project documentation.
    `,
    license: {
      name: 'Private',
      url: 'https://github.com/microsoft/elevate',
    },
    contact: {
      name: 'MS Elevate Team',
      email: 'elevate-support@microsoft.com',
    },
  },
  servers: [
    {
      url: 'https://leaps.mereka.org',
      description: 'Production server',
    },
    {
      url: 'https://leaps-staging.mereka.org',
      description: 'Staging server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  tags: [
    {
      name: 'Submissions',
      description: 'LEAPS activity submission management',
    },
    {
      name: 'Files',
      description: 'Evidence file upload and management',
    },
    {
      name: 'Public',
      description: 'Public endpoints (leaderboard, profiles)',
    },
    {
      name: 'Dashboard',
      description: 'User dashboard and progress tracking',
    },
    {
      name: 'Admin',
      description: 'Administrative endpoints for reviewers',
    },
    {
      name: 'Webhooks',
      description: 'External service integration webhooks',
    },
    {
      name: 'System',
      description: 'Health checks and system status',
    },
  ],
});

// Export for direct use
export default openApiSpec;