/**
 * OpenAPI specification generator for MS Elevate LEAPS Tracker API
 *
 * Generates comprehensive OpenAPI 3.1 specification from Zod schemas
 */

import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi'
import type { OpenAPIObject } from 'openapi3-ts/oas31'
import { z } from 'zod'

import { BadgeCriteriaSchema } from '@elevate/types/common'
import {
  MetricsQuerySchema,
  HandleParamSchema,
} from '@elevate/types/query-schemas'

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
  ErrorEnvelopeSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
  AdminSubmissionsListResponseSchema,
  AdminSubmissionDetailResponseSchema,
  AdminUsersListResponseSchema,
  AdminBadgesListResponseSchema,
  AdminAnalyticsResponseSchema,
  AdminKajabiResponseSchema,
  AdminCohortsResponseSchema,
  PlatformStatsResponseSchema,
  StageMetricsResponseSchema,
  ProfileResponseSchema,
} from './schemas'

// Create OpenAPI registry
const registry = new OpenAPIRegistry()

// Register common schemas
registry.register('ActivityCode', ActivityCodeSchema)
registry.register('SubmissionStatus', SubmissionStatusSchema)
registry.register('Visibility', VisibilitySchema)
registry.register('LearnSubmission', LearnSchemaWithOpenApi)
registry.register('ExploreSubmission', ExploreSchemaWithOpenApi)
registry.register('AmplifySubmission', AmplifySchemaWithOpenApi)
registry.register('PresentSubmission', PresentSchemaWithOpenApi)
registry.register('ShineSubmission', ShineSchemaWithOpenApi)
registry.register('SubmissionRequest', SubmissionRequestSchema)
registry.register('SubmissionResponse', SubmissionResponseSchema)
registry.register('LeaderboardResponse', LeaderboardResponseSchema)
registry.register('FileUploadResponse', FileUploadResponseSchema)
registry.register('ErrorEnvelope', ErrorEnvelopeSchema)
registry.register('ErrorResponse', ErrorResponseSchema)
registry.register('SuccessResponse', SuccessResponseSchema)

// Security schemes
registry.registerComponent('securitySchemes', 'ClerkAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Clerk JWT token for authenticated requests',
})

// Register API endpoints

// Public: Platform stats
registry.registerPath({
  method: 'get',
  path: '/api/stats',
  description: 'Get platform-wide statistics',
  summary: 'Platform Stats',
  tags: ['Public'],
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: PlatformStatsResponseSchema } },
    },
  },
})

// Admin: User detail (GET/PATCH)
registry.registerPath({
  method: 'get',
  path: '/api/admin/users/{id}',
  description: 'Get admin view of a single user by id',
  summary: 'Admin User Detail',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              user: z.object({
                id: z.string(),
                email: z.string(),
                name: z.string().nullable().optional(),
                handle: z.string().nullable().optional(),
                user_type: z.enum(['EDUCATOR', 'STUDENT']),
                user_type_confirmed: z.boolean(),
                school: z.string().nullable().optional(),
                region: z.string().nullable().optional(),
                kajabi_contact_id: z.string().nullable().optional(),
                created_at: z.string().datetime(),
              }),
            }),
          }),
        },
      },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/admin/users/{id}',
  description: 'Update user_type, user_type_confirmed, school, or region',
  summary: 'Admin Update User Profile Fields',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            userType: z.enum(['EDUCATOR', 'STUDENT']).optional(),
            userTypeConfirmed: z.boolean().optional(),
            school: z.string().optional(),
            region: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              user: z.object({
                id: z.string(),
                email: z.string(),
                name: z.string().nullable().optional(),
                handle: z.string().nullable().optional(),
                user_type: z.enum(['EDUCATOR', 'STUDENT']),
                user_type_confirmed: z.boolean(),
                school: z.string().nullable().optional(),
                region: z.string().nullable().optional(),
                kajabi_contact_id: z.string().nullable().optional(),
                created_at: z.string().datetime(),
              }),
            }),
          }),
        },
      },
    },
    400: { description: 'Invalid', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// Admin: Bulk LEAPS updates
registry.registerPath({
  method: 'post',
  path: '/api/admin/users/leaps',
  description: 'Bulk update LEAPS fields (userType, userTypeConfirmed, school, region)',
  summary: 'Admin Bulk LEAPS Update',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            userIds: z.array(z.string()).min(1),
            userType: z.enum(['EDUCATOR', 'STUDENT']).optional(),
            userTypeConfirmed: z.boolean().optional(),
            school: z.string().optional(),
            region: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Bulk update results',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.object({ processed: z.number().int(), failed: z.number().int(), errors: z.array(z.object({ userId: z.string(), error: z.string() })) }),
          }),
        },
      },
    },
    400: { description: 'Invalid', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// Admin: Kajabi health
registry.registerPath({
  method: 'get',
  path: '/api/admin/kajabi/health',
  description: 'Check Kajabi connectivity and environment presence',
  summary: 'Kajabi Health',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              healthy: z.boolean(),
              hasKey: z.boolean(),
              hasSecret: z.boolean(),
            }),
          }),
        },
      },
    },
  },
})

// Admin: Kajabi invite
registry.registerPath({
  method: 'post',
  path: '/api/admin/kajabi/invite',
  description: 'Force-enroll a user in Kajabi by userId or email and optionally grant an offer',
  summary: 'Kajabi Invite',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            userId: z.string().optional(),
            email: z.string().email().optional(),
            name: z.string().optional(),
            offerId: z.union([z.string(), z.number()]).optional(),
          }).refine((v) => !!v.userId || !!v.email, { message: 'userId or email is required' }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Invitation sent',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.object({ invited: z.boolean(), contactId: z.number().optional(), withOffer: z.boolean() }),
          }),
        },
      },
    },
    400: { description: 'Invalid', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
    502: { description: 'Upstream error', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// Admin: Storage retention
registry.registerPath({
  method: 'post',
  path: '/api/admin/storage/retention',
  description: 'Enforce evidence retention policy for a user',
  summary: 'Storage Retention',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ userId: z.string(), days: z.coerce.number().int().min(1).max(3650).optional() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Retention enforced',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.object({ userId: z.string(), days: z.number(), deleted: z.number() }),
          }),
        },
      },
    },
    400: { description: 'Invalid', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// Admin: SLO summary (internal)
registry.registerPath({
  method: 'get',
  path: '/api/admin/slo/summary',
  description: 'Get SLO summary or a specific SLO status (internal admin use)',
  summary: 'SLO Summary',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    query: z.object({ slo: z.string().optional() }),
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// Public: Stage metrics
registry.registerPath({
  method: 'get',
  path: '/api/metrics',
  description: 'Get metrics for a LEAPS stage',
  summary: 'Stage Metrics',
  tags: ['Public'],
  request: { query: MetricsQuerySchema },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: StageMetricsResponseSchema } },
    },
    400: {
      description: 'Invalid query',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

// Public: Profile by handle
registry.registerPath({
  method: 'get',
  path: '/api/profile/{handle}',
  description: 'Get public profile data by handle',
  summary: 'Public Profile',
  tags: ['Public'],
  request: { params: HandleParamSchema },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: ProfileResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

// Admin: Referrals list
registry.registerPath({
  method: 'get',
  path: '/api/admin/referrals',
  description: 'List referral events with filters',
  summary: 'Admin Referrals',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    query: z.object({
      referrerId: z.string().optional(),
      refereeId: z.string().optional(),
      email: z.string().email().optional(),
      month: z.string().regex(/^\d{4}-\d{2}$/).optional().openapi({ example: '2025-09' }),
      limit: z.number().int().min(1).max(200).optional().openapi({ example: 50 }),
      offset: z.number().int().min(0).optional().openapi({ example: 0 }),
    }),
  },
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              referrals: z.array(
                z.object({
                  id: z.string(),
                  eventType: z.string(),
                  source: z.string().nullable().optional(),
                  createdAt: z.string().datetime(),
                  externalEventId: z.string().nullable().optional(),
                  referrer: z.object({ id: z.string(), name: z.string(), email: z.string() }),
                  referee: z.object({ id: z.string(), name: z.string(), email: z.string(), user_type: z.enum(['EDUCATOR', 'STUDENT']) }),
                }),
              ),
              pagination: z.object({ total: z.number().int(), limit: z.number().int(), offset: z.number().int(), pages: z.number().int() }),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

// Admin: Referrals summary
registry.registerPath({
  method: 'get',
  path: '/api/admin/referrals/summary',
  description: 'Monthly summary for referrals',
  summary: 'Admin Referrals Summary',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).openapi({ example: '2025-09' }) }),
  },
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              month: z.string(),
              total: z.number().int(),
              byType: z.object({ educators: z.number().int(), students: z.number().int() }),
              uniqueReferrers: z.number().int(),
              pointsAwarded: z.number().int(),
              topReferrers: z.array(z.object({ userId: z.string(), points: z.number().int(), user: z.object({ id: z.string(), name: z.string(), email: z.string(), handle: z.string(), user_type: z.enum(['EDUCATOR','STUDENT']) }) })),
            }),
          }),
        },
      },
    },
  },
})

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
          schema: z
            .object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().openapi({ example: 'sub_abc123' }),
                activityCode: ActivityCodeSchema,
                status: SubmissionStatusSchema,
                visibility: VisibilitySchema,
                createdAt: z
                  .string()
                  .datetime()
                  .openapi({ example: '2024-01-15T10:00:00Z' }),
                potentialPoints: z.number().int().openapi({ example: 20 }),
              }),
            })
            .openapi({ title: 'Submission Creation Response' }),
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
})

// Referrals: Get invite link for current user
registry.registerPath({
  method: 'get',
  path: '/api/referrals/link',
  description: 'Get or allocate a referral code and share link for the current user',
  summary: 'My Referral Link',
  tags: ['Referrals'],
  security: [{ ClerkAuth: [] }],
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.object({ refCode: z.string(), link: z.string().url() }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

// Profile onboarding
registry.registerPath({
  method: 'post',
  path: '/api/profile/onboarding',
  description: 'Complete required onboarding fields (role; educator school+region) and mirror to Clerk',
  summary: 'Profile Onboarding',
  tags: ['Profile'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            userType: z.enum(['EDUCATOR', 'STUDENT']),
            school: z.string().optional(),
            region: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: SuccessResponseSchema } } },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

// Schools search
registry.registerPath({
  method: 'get',
  path: '/api/schools',
  description: 'Autocomplete search for schools by name',
  summary: 'Schools Search',
  tags: ['Profile'],
  request: {
    query: z.object({
      q: z.string().min(1).openapi({ description: 'Search query', example: 'Universitas' }),
      limit: z.number().int().min(1).max(50).optional().openapi({ example: 20 }),
    }),
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: SuccessResponseSchema.extend({ data: z.array(z.object({ name: z.string(), city: z.string().nullable().optional(), province: z.string().nullable().optional() })) }) } },
    },
    400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
})

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
          schema: z
            .object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(SubmissionResponseSchema),
            })
            .openapi({ title: 'Submissions List Response' }),
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
})

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
})

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
})

// Badges endpoint
registry.registerPath({
  method: 'get',
  path: '/api/badges',
  description: "Get current user's earned badges",
  summary: 'Get User Badges',
  tags: ['Badges'],
  security: [{ ClerkAuth: [] }],
  responses: {
    200: {
      description: 'User badges retrieved successfully',
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                badges: z.array(
                  z.object({
                    code: z.string().openapi({ example: 'EARLY_ADOPTER' }),
                    name: z.string().openapi({ example: 'Early Adopter' }),
                    description: z.string().openapi({
                      example: 'One of the first educators to join the program',
                    }),
                    iconUrl: z
                      .string()
                      .url()
                      .nullable()
                      .openapi({ example: 'https://example.com/badge.png' }),
                    criteria: BadgeCriteriaSchema.openapi({
                      example: { type: 'submissions', threshold: 1 },
                    }),
                    earnedAt: z
                      .string()
                      .datetime()
                      .openapi({ example: '2024-01-15T10:00:00Z' }),
                  }),
                ),
              }),
            })
            .openapi({ title: 'User Badges Response' }),
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
})

// Dashboard endpoint
registry.registerPath({
  method: 'get',
  path: '/api/dashboard',
  description:
    'Get user dashboard data including progress and recent submissions',
  summary: 'Get User Dashboard',
  tags: ['Dashboard'],
  security: [{ ClerkAuth: [] }],
  responses: {
    200: {
      description: 'Dashboard data retrieved successfully',
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                user: z.object({
                  id: z.string().openapi({ example: 'user_123' }),
                  name: z.string().openapi({ example: 'Ahmad Sutanto' }),
                  handle: z.string().openapi({ example: 'educator_ahmad' }),
                  email: z
                    .string()
                    .email()
                    .openapi({ example: 'ahmad@school.edu' }),
                  school: z
                    .string()
                    .nullable()
                    .openapi({ example: 'SDN 123 Jakarta' }),
                  cohort: z
                    .string()
                    .nullable()
                    .openapi({ example: 'Cohort-2024-A' }),
                  avatar_url: z.string().url().nullable().openapi({
                    example: 'https://images.clerk.dev/abc123',
                  }),
                  profile_visibility: z.boolean().openapi({
                    example: false,
                    description: 'Whether profile is publicly visible',
                  }),
                }),
                progress: z.object({
                  totalPoints: z.number().int().openapi({ example: 95 }),
                  completedActivities: z.number().int().openapi({ example: 4 }),
                  totalActivities: z.number().int().openapi({ example: 5 }),
                  leaderboardRank: z
                    .number()
                    .int()
                    .nullable()
                    .openapi({ example: 15 }),
                }),
                recentSubmissions: z.array(SubmissionResponseSchema),
                availableActivities: z.array(
                  z.object({
                    code: ActivityCodeSchema,
                    name: z.string().openapi({ example: 'Learn' }),
                    description: z.string().openapi({
                      example: 'Complete AI training and upload certificate',
                    }),
                    default_points: z.number().int().openapi({ example: 20 }),
                    hasSubmission: z.boolean().openapi({ example: true }),
                    submissionStatus: SubmissionStatusSchema.nullable().openapi(
                      { example: 'APPROVED' },
                    ),
                  }),
                ),
              }),
            })
            .openapi({ title: 'Dashboard Response' }),
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
})

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
          schema: z
            .object({
              status: z.string().openapi({ example: 'healthy' }),
              timestamp: z
                .string()
                .datetime()
                .openapi({ example: '2024-01-15T10:00:00Z' }),
              version: z.string().openapi({ example: '0.1.0' }),
            })
            .openapi({ title: 'Health Check Response' }),
        },
      },
    },
  },
})

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
          schema: z
            .object({
              event_type: z.string().openapi({ example: 'course_completion' }),
              user_email: z
                .string()
                .email()
                .openapi({ example: 'ahmad@school.edu' }),
              course_name: z.string().openapi({ example: 'AI for Educators' }),
              completed_at: z
                .string()
                .datetime()
                .openapi({ example: '2024-01-15T10:00:00Z' }),
              certificate_url: z.string().url().optional().openapi({
                example: 'https://kajabi.com/certificates/abc123',
              }),
            })
            .openapi({ title: 'Kajabi Webhook Payload' }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Webhook processed successfully',
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.boolean().openapi({ example: true }),
              processed: z.boolean().openapi({ example: true }),
              user_matched: z.boolean().openapi({ example: true }),
            })
            .openapi({ title: 'Webhook Response' }),
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
})

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
        'application/json': { schema: AdminSubmissionsListResponseSchema },
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
})

// Admin: Submission detail
registry.registerPath({
  method: 'get',
  path: '/api/admin/submissions/{id}',
  description: 'Get a single submission by ID (admin/reviewer)',
  summary: 'Get Submission Detail',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    params: z.object({
      id: z
        .string()
        .openapi({ description: 'Submission ID', example: 'sub_abc123' }),
    }),
  },
  responses: {
    200: {
      description: 'Submission retrieved',
      content: {
        'application/json': { schema: AdminSubmissionDetailResponseSchema },
      },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

// Admin: Review single submission
registry.registerPath({
  method: 'patch',
  path: '/api/admin/submissions',
  description: 'Approve or reject a submission',
  summary: 'Review Submission',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            submissionId: z.string(),
            action: z.enum(['approve', 'reject']),
            reviewNote: z.string().optional(),
            pointAdjustment: z.number().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Reviewed',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
    400: {
      description: 'Invalid body',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

// Admin: Bulk review
registry.registerPath({
  method: 'post',
  path: '/api/admin/submissions',
  description: 'Bulk approve or reject submissions',
  summary: 'Bulk Review Submissions',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            submissionIds: z.array(z.string()),
            action: z.enum(['approve', 'reject']),
            reviewNote: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Processed',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
    400: {
      description: 'Invalid body',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

// Admin: Users list
registry.registerPath({
  method: 'get',
  path: '/api/admin/users',
  description: 'List users with search and filters',
  summary: 'Admin Users',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    query: z.object({
      search: z.string().optional(),
      role: z
        .enum(['ALL', 'PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN'])
        .optional(),
      userType: z.enum(['ALL', 'EDUCATOR', 'STUDENT']).optional(),
      kajabi: z.enum(['ALL', 'LINKED', 'UNLINKED']).optional(),
      cohort: z.string().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      sortBy: z.enum(['created_at', 'name', 'email']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Users retrieved',
      content: { 'application/json': { schema: AdminUsersListResponseSchema } },
    },
    400: {
      description: 'Invalid query',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

// Admin: Update user
registry.registerPath({
  method: 'patch',
  path: '/api/admin/users',
  description: 'Update a single user',
  summary: 'Update User',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ userId: z.string() }).passthrough(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
    400: {
      description: 'Invalid body',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

// Admin: Bulk update users
registry.registerPath({
  method: 'post',
  path: '/api/admin/users',
  description: 'Bulk update user roles',
  summary: 'Bulk Update Users',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ userIds: z.array(z.string()), role: z.string() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
    400: {
      description: 'Invalid body',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

// Admin: Badges
registry.registerPath({
  method: 'get',
  path: '/api/admin/badges',
  description: 'List badges',
  summary: 'List Badges',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    query: z.object({ includeStats: z.enum(['true', 'false']).optional() }),
  },
  responses: {
    200: {
      description: 'OK',
      content: {
        'application/json': { schema: AdminBadgesListResponseSchema },
      },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/admin/badges',
  description: 'Create a badge',
  summary: 'Create Badge',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              code: z.string(),
              name: z.string(),
              description: z.string(),
            })
            .passthrough(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Created',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/admin/badges',
  description: 'Update a badge',
  summary: 'Update Badge',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ code: z.string() }).passthrough(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/admin/badges',
  description: 'Delete a badge by code',
  summary: 'Delete Badge',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: { query: z.object({ code: z.string() }) },
  responses: {
    200: {
      description: 'Deleted',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/admin/badges/assign',
  description: 'Assign a badge to users',
  summary: 'Assign Badge',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            badgeCode: z.string(),
            userIds: z.array(z.string()),
            reason: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Assigned',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/admin/badges/assign',
  description: 'Remove a badge from users',
  summary: 'Remove Badge',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            badgeCode: z.string(),
            userIds: z.array(z.string()),
            reason: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Removed',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
  },
})

// Admin: Analytics
registry.registerPath({
  method: 'get',
  path: '/api/admin/analytics',
  description: 'Get analytics data',
  summary: 'Analytics',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    query: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      cohort: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AdminAnalyticsResponseSchema } },
    },
  },
})

// Admin: Exports (CSV)
registry.registerPath({
  method: 'get',
  path: '/api/admin/exports',
  description: 'Export data as CSV',
  summary: 'Exports',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    query: z.object({
      type: z.enum(['submissions', 'users', 'leaderboard', 'points']),
      format: z.literal('csv'),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      activity: z.string().optional(),
      status: z.string().optional(),
      cohort: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'CSV content',
      content: {
        'text/csv': {
          schema: z.string().openapi({ example: 'col1,col2\nval1,val2' }),
        },
      },
    },
    400: {
      description: 'Invalid query',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

// Admin: Kajabi tools
registry.registerPath({
  method: 'get',
  path: '/api/admin/kajabi',
  description: 'List recent Kajabi webhook events and stats',
  summary: 'Kajabi Events',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AdminKajabiResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/admin/kajabi/test',
  description: 'Create a test Kajabi completion event for a user',
  summary: 'Kajabi Test Event',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            user_email: z.string().email(),
            course_name: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Created',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/admin/kajabi/reprocess',
  description: 'Reprocess a stored Kajabi event by ID',
  summary: 'Kajabi Reprocess',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: z.object({ event_id: z.string() }) },
      },
    },
  },
  responses: {
    200: {
      description: 'Reprocessed',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
  },
})

// Admin: Meta cohorts
registry.registerPath({
  method: 'get',
  path: '/api/admin/meta/cohorts',
  description: 'List available cohorts',
  summary: 'Cohorts',
  tags: ['Admin'],
  security: [{ ClerkAuth: [] }],
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AdminCohortsResponseSchema } },
    },
  },
})

// Register webhook security scheme
registry.registerComponent('securitySchemes', 'WebhookSignature', {
  type: 'apiKey',
  in: 'header',
  name: 'X-Kajabi-Signature',
  description: 'Kajabi webhook signature for request verification',
})

// Generate OpenAPI specification
const generator = new OpenApiGeneratorV31(registry.definitions)

export function getOpenApiSpec(): OpenAPIObject {
  return generator.generateDocument({
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
        name: 'Badges',
        description: 'User badge management and achievement tracking',
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
  })
}

// Note: openApiSpec constant intentionally not exported to avoid API Extractor bug
