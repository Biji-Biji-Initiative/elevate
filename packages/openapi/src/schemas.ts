import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { SubmissionPayloadSchema } from '@elevate/types/submission-payloads';
import { BadgeCriteriaSchema } from '@elevate/types/common';
import { KajabiTagEventSchema } from '@elevate/types/webhooks';

// Extend Zod with OpenAPI functionality
extendZodWithOpenApi(z);

// Activity codes enum with OpenAPI metadata
export const ActivityCodeSchema = z
  .enum(['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE'])
  .openapi({
    description: 'LEAPS activity codes',
    example: 'LEARN',
  });

// Status enum with OpenAPI metadata
export const SubmissionStatusSchema = z
  .enum(['PENDING', 'APPROVED', 'REJECTED'])
  .openapi({
    description: 'Submission review status',
    example: 'PENDING',
  });

// Visibility enum with OpenAPI metadata
export const VisibilitySchema = z
  .enum(['PUBLIC', 'PRIVATE'])
  .openapi({
    description: 'Submission visibility setting',
    example: 'PRIVATE',
  });

// LEAPS schemas with OpenAPI metadata
export const LearnSchemaWithOpenApi = z.object({
  provider: z.enum(['SPL', 'ILS']),
  course: z.string().min(2),
  completedAt: z.string(),
  certificateFile: z.string().optional().describe('Storage path after upload'),
}).openapi({
  title: 'Learn Submission',
  description: 'Schema for Learn activity submissions (certificate upload)',
  example: {
    provider: 'SPL',
    course: 'AI for Educators',
    completedAt: '2024-01-15T10:00:00Z',
    certificateFile: 'evidence/learn/user123/certificate.pdf',
  },
});

export const ExploreSchemaWithOpenApi = z.object({
  reflection: z.string().min(150),
  classDate: z.string(),
  school: z.string().optional(),
  evidenceFiles: z.array(z.string()).optional().describe('Array of storage paths after upload'),
}).openapi({
  title: 'Explore Submission',
  description: 'Schema for Explore activity submissions (classroom AI application)',
  example: {
    reflection: 'I successfully integrated AI tools into my mathematics class by using ChatGPT to create personalized word problems for each student based on their skill level. The students were more engaged and showed improved problem-solving skills.',
    classDate: '2024-01-20',
    school: 'SDN 123 Jakarta',
    evidenceFiles: [
      'evidence/explore/user123/classroom_photo.jpg',
      'evidence/explore/user123/student_work.pdf',
    ],
  },
});

export const AmplifySchemaWithOpenApi = z.object({
  peersTrained: z.coerce.number().int().min(0).max(50),
  studentsTrained: z.coerce.number().int().min(0).max(200),
  attendanceProofFiles: z.array(z.string()).optional().describe('Array of storage paths after upload'),
}).openapi({
  title: 'Amplify Submission',
  description: 'Schema for Amplify activity submissions (training others)',
  example: {
    peersTrained: 5,
    studentsTrained: 25,
    attendanceProofFiles: [
      'evidence/amplify/user123/attendance_sheet.pdf',
      'evidence/amplify/user123/training_photos.jpg',
    ],
  },
});

export const PresentSchemaWithOpenApi = z.object({
  linkedinUrl: z.string().url(),
  screenshotFile: z.string().optional().describe('Storage path after upload'),
  caption: z.string().min(10),
}).openapi({
  title: 'Present Submission',
  description: 'Schema for Present activity submissions (LinkedIn sharing)',
  example: {
    linkedinUrl: 'https://linkedin.com/posts/educator123_ai-education-innovation',
    screenshotFile: 'evidence/present/user123/linkedin_screenshot.png',
    caption: 'Excited to share how AI is transforming my classroom!',
  },
});

export const ShineSchemaWithOpenApi = z.object({
  ideaTitle: z.string().min(4),
  ideaSummary: z.string().min(50),
  attachment: z.array(z.string()).optional().describe('Array of storage paths after upload'),
}).openapi({
  title: 'Shine Submission',
  description: 'Schema for Shine activity submissions (innovative ideas)',
  example: {
    ideaTitle: 'AI-Powered Student Assessment',
    ideaSummary: 'A comprehensive system that uses AI to provide real-time feedback and adaptive assessment for students, helping teachers identify learning gaps instantly.',
    attachment: ['evidence/shine/user123/idea_presentation.pdf'],
  },
});

// Common request/response schemas
export const SubmissionRequestSchema = z
  .object({
    activityCode: ActivityCodeSchema,
    payload: z.object({}).passthrough().openapi({
      description: 'Activity-specific data matching the corresponding schema',
    }),
    attachments: z.array(z.string()).optional().openapi({
      description: 'Array of file storage paths',
      example: ['evidence/learn/user123/certificate.pdf'],
    }),
    visibility: VisibilitySchema.optional(),
  })
  .openapi({
    title: 'Submission Request',
    description: 'Request body for creating a new submission',
  });

export const SubmissionResponseSchema = z
  .object({
    id: z.string().openapi({
      description: 'Unique submission identifier',
      example: 'sub_abc123',
    }),
    activityCode: ActivityCodeSchema,
    activityName: z.string().openapi({
      description: 'Human-readable activity name',
      example: 'Learn',
    }),
    status: SubmissionStatusSchema,
    visibility: VisibilitySchema,
    createdAt: z.string().datetime().openapi({
      description: 'ISO 8601 timestamp',
      example: '2024-01-15T10:00:00Z',
    }),
    updatedAt: z.string().datetime().optional().openapi({
      description: 'ISO 8601 timestamp',
      example: '2024-01-16T10:00:00Z',
    }),
    reviewNote: z.string().nullable().optional().openapi({
      description: 'Reviewer feedback message',
      example: 'Certificate looks good, approved!',
    }),
    attachmentCount: z.number().int().openapi({
      description: 'Number of attached files',
      example: 1,
    }),
    potentialPoints: z.number().int().optional().openapi({
      description: 'Points that could be earned if approved',
      example: 20,
    }),
  })
  .openapi({
    title: 'Submission Response',
    description: 'Response format for submission data',
  });

export const LeaderboardEntrySchema = z
  .object({
    rank: z.number().int().openapi({
      description: 'Current leaderboard position',
      example: 1,
    }),
    user: z.object({
      id: z.string().openapi({
        description: 'User identifier',
        example: 'user_123',
      }),
      handle: z.string().openapi({
        description: 'Unique user handle',
        example: 'educator_ahmad',
      }),
      name: z.string().openapi({
        description: 'User display name',
        example: 'Ahmad Sutanto',
      }),
      school: z.string().nullable().openapi({
        description: 'School/institution name',
        example: 'SDN 123 Jakarta',
      }),
      cohort: z.string().nullable().openapi({
        description: 'Training cohort identifier',
        example: 'Cohort-2024-A',
      }),
      avatar_url: z.string().url().nullable().openapi({
        description: 'Profile picture URL',
        example: 'https://images.clerk.dev/abc123',
      }),
      _sum: z.object({
        points: z.number().int().openapi({
          description: 'Total points earned',
          example: 95,
        }),
        learn_points: z.number().int().openapi({
          description: 'Points from Learn activities',
          example: 20,
        }),
        explore_points: z.number().int().openapi({
          description: 'Points from Explore activities',
          example: 50,
        }),
        amplify_points: z.number().int().openapi({
          description: 'Points from Amplify activities',
          example: 15,
        }),
        present_points: z.number().int().openapi({
          description: 'Points from Present activities',
          example: 10,
        }),
        shine_points: z.number().int().openapi({
          description: 'Points from Shine activities',
          example: 0,
        }),
        submission_count: z.number().int().openapi({
          description: 'Total approved submissions',
          example: 7,
        }),
      }).openapi({
        title: 'User Points Summary',
        description: 'Breakdown of user points by category',
      }),
      earned_badges: z.array(z.object({
        badge: z.object({
          code: z.string().openapi({
            description: 'Badge identifier',
            example: 'EARLY_ADOPTER',
          }),
          name: z.string().openapi({
            description: 'Badge display name',
            example: 'Early Adopter',
          }),
          icon_url: z.string().url().nullable().openapi({
            description: 'Badge icon URL',
            example: 'https://storage.supabase.co/badges/early_adopter.svg',
          }),
        }),
      })).openapi({
        description: 'Badges earned by the user',
      }),
    }),
  })
  .openapi({
    title: 'Leaderboard Entry',
    description: 'Individual leaderboard entry with user and score data',
  });

export const LeaderboardResponseSchema = z
  .object({
    period: z.enum(['all', '30d']).openapi({
      description: 'Leaderboard time period',
      example: 'all',
    }),
    data: z.array(LeaderboardEntrySchema),
    total: z.number().int().openapi({
      description: 'Total number of ranked users',
      example: 150,
    }),
    limit: z.number().int().openapi({
      description: 'Number of entries returned',
      example: 20,
    }),
    offset: z.number().int().openapi({
      description: 'Starting position for pagination',
      example: 0,
    }),
    hasMore: z.boolean().openapi({
      description: 'Whether more results are available',
      example: true,
    }),
  })
  .openapi({
    title: 'Leaderboard Response',
    description: 'Paginated leaderboard data with user rankings',
  });

export const FileUploadResponseSchema = z
  .object({
    success: z.boolean().openapi({
      description: 'Upload success status',
      example: true,
    }),
    data: z.object({
      path: z.string().openapi({
        description: 'Storage path of uploaded file',
        example: 'evidence/learn/user123/certificate.pdf',
      }),
      hash: z.string().openapi({
        description: 'File content hash for deduplication',
        example: 'sha256:abc123...',
      }),
      filename: z.string().openapi({
        description: 'Original filename',
        example: 'certificate.pdf',
      }),
      size: z.number().int().openapi({
        description: 'File size in bytes',
        example: 1024000,
      }),
      type: z.string().openapi({
        description: 'MIME type',
        example: 'application/pdf',
      }),
    }),
  })
  .openapi({
    title: 'File Upload Response',
    description: 'Response from successful file upload',
  });

// -----------------------------
// Public metrics and profile schemas
// -----------------------------

export const StageStatsSchema = z.object({
  total: z.number().int(),
  approved: z.number().int(),
  pending: z.number().int(),
  rejected: z.number().int(),
})

export const PlatformStatsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    totalEducators: z.number().int(),
    totalSubmissions: z.number().int(),
    totalPoints: z.number().int(),
    studentsImpacted: z.number().int(),
    byStage: z.record(StageStatsSchema),
  })
}).openapi({
  title: 'Platform Stats Response',
})

export const StageMetricsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    stage: z.string(),
    totalSubmissions: z.number().int(),
    approvedSubmissions: z.number().int(),
    pendingSubmissions: z.number().int(),
    rejectedSubmissions: z.number().int(),
    avgPointsEarned: z.number(),
    uniqueEducators: z.number().int(),
    topSchools: z.array(z.object({ name: z.string(), count: z.number().int() })),
    cohortBreakdown: z.array(z.object({ cohort: z.string(), count: z.number().int() })),
    monthlyTrend: z.array(z.object({ month: z.string(), submissions: z.number().int(), approvals: z.number().int() })),
    completionRate: z.number(),
  })
}).openapi({ title: 'Stage Metrics Response' })

export const ProfileSubmissionSchema = z.object({
  id: z.string(),
  activity_code: ActivityCodeSchema,
  activity: z.object({ name: z.string(), code: ActivityCodeSchema }),
  status: SubmissionStatusSchema,
  visibility: VisibilitySchema,
  payload: SubmissionPayloadSchema.transform(p => p.data).openapi({
    description: 'Submission payload data specific to each activity type'
  }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
})

export const ProfileBadgeSchema = z.object({
  badge: z.object({ code: z.string(), name: z.string(), description: z.string().optional(), icon_url: z.string().nullable().optional() }),
  earned_at: z.string().datetime(),
})

export const ProfileResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    handle: z.string(),
    name: z.string(),
    school: z.string().nullable().optional(),
    cohort: z.string().nullable().optional(),
    created_at: z.string().datetime(),
    _sum: z.object({ points: z.number().int() }),
    earned_badges: z.array(ProfileBadgeSchema),
    submissions: z.array(ProfileSubmissionSchema),
  })
}).openapi({ title: 'Profile Response' })

// -----------------------------
// Admin-specific schemas
// -----------------------------

export const AdminPaginationSchema = z.object({
  page: z.number().int().openapi({ example: 1 }),
  limit: z.number().int().openapi({ example: 50 }),
  total: z.number().int().openapi({ example: 250 }),
  pages: z.number().int().openapi({ example: 5 }),
})

export const AdminUserMiniSchema = z.object({
  id: z.string().openapi({ example: 'user_123' }),
  name: z.string().openapi({ example: 'Ahmad Sutanto' }),
  handle: z.string().openapi({ example: 'educator_ahmad' }),
  email: z.string().email().optional(),
  school: z.string().nullable().optional(),
  cohort: z.string().nullable().optional(),
})

export const AdminActivitySchema = z.object({
  code: ActivityCodeSchema,
  name: z.string().openapi({ example: 'Learn' }),
  default_points: z.number().int().optional().openapi({ example: 20 })
})

export const AdminSubmissionSchema = z.object({
  id: z.string().openapi({ example: 'sub_abc123' }),
  created_at: z.string().datetime().openapi({ example: '2024-01-15T10:00:00Z' }),
  updated_at: z.string().datetime().nullable().optional(),
  status: SubmissionStatusSchema,
  visibility: VisibilitySchema,
  review_note: z.string().nullable().optional(),
  attachments: z.array(z.unknown()).optional(),
  attachmentCount: z.number().int().optional().openapi({ example: 2 }),
  user: AdminUserMiniSchema,
  activity: AdminActivitySchema,
})

export const AdminUsersListItemSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  email: z.string(),
  avatar_url: z.string().nullable().optional(),
  role: z.enum(['PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN']),
  school: z.string().nullable().optional(),
  cohort: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  _count: z.object({ submissions: z.number().int(), earned_badges: z.number().int(), ledger: z.number().int() }),
  totalPoints: z.number().int(),
})

export const AdminSubmissionsListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    submissions: z.array(AdminSubmissionSchema),
    pagination: AdminPaginationSchema,
  })
}).openapi({ 
  title: 'Admin Submissions List Response',
  example: {
    success: true,
    data: {
      submissions: [
        {
          id: 'sub_abc123',
          created_at: '2024-02-01T10:00:00Z',
          updated_at: '2024-02-01T10:05:00Z',
          status: 'PENDING',
          visibility: 'PRIVATE',
          review_note: null,
          attachmentCount: 0,
          user: {
            id: 'user_123',
            name: 'Ahmad Sutanto',
            handle: 'educator_ahmad',
            email: 'ahmad@school.edu',
            school: 'SDN 123 Jakarta',
            cohort: 'Cohort-2024-A'
          },
          activity: { code: 'LEARN', name: 'Learn', default_points: 20 }
        }
      ],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 }
    }
  }
})

export const AdminSubmissionDetailResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ submission: AdminSubmissionSchema })
}).openapi({ 
  title: 'Admin Submission Detail Response',
  example: {
    success: true,
    data: {
      submission: {
        id: 'sub_abc123',
        created_at: '2024-02-01T10:00:00Z',
        status: 'PENDING',
        visibility: 'PRIVATE',
        review_note: null,
        user: { id: 'user_123', name: 'Ahmad Sutanto', handle: 'educator_ahmad', email: 'ahmad@school.edu' },
        activity: { code: 'LEARN', name: 'Learn', default_points: 20 }
      }
    }
  }
})

export const AdminUsersListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    users: z.array(AdminUsersListItemSchema),
    pagination: AdminPaginationSchema,
  })
}).openapi({ 
  title: 'Admin Users List Response',
  example: {
    success: true,
    data: {
      users: [
        {
          id: 'user_123', handle: 'educator_ahmad', name: 'Ahmad Sutanto', email: 'ahmad@school.edu',
          role: 'PARTICIPANT', created_at: '2024-01-10T09:00:00Z',
          _count: { submissions: 7, earned_badges: 2, ledger: 10 }, totalPoints: 95
        }
      ],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 }
    }
  }
})

export const AdminBadgeCriteriaSchema = BadgeCriteriaSchema.openapi({
  description: 'Badge criteria configuration'
})

export const AdminBadgeSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  criteria: AdminBadgeCriteriaSchema,
  icon_url: z.string().url().nullable().optional(),
  _count: z.object({ earned_badges: z.number().int() }).partial().optional(),
  earned_badges: z.array(z.object({
    id: z.string(),
    user: z.object({ id: z.string(), name: z.string(), handle: z.string() }),
    earned_at: z.string().datetime(),
  })).optional(),
})

export const AdminBadgesListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ badges: z.array(AdminBadgeSchema) })
}).openapi({ 
  title: 'Admin Badges List Response',
  example: {
    success: true,
    data: {
      badges: [
        { code: 'EARLY_ADOPTER', name: 'Early Adopter', description: 'Joined early', criteria: { type: 'points', threshold: 50 }, icon_url: null, _count: { earned_badges: 25 } }
      ]
    }
  }
})

export const AdminAnalyticsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    overview: z.object({
      submissions: z.object({ total: z.number(), pending: z.number(), approved: z.number(), rejected: z.number(), approvalRate: z.number() }),
      users: z.object({ total: z.number(), active: z.number(), withSubmissions: z.number(), withBadges: z.number(), activationRate: z.number() }),
      points: z.object({ totalAwarded: z.number(), totalEntries: z.number(), avgPerEntry: z.number() }),
      badges: z.object({ totalBadges: z.number(), totalEarned: z.number(), uniqueEarners: z.number() }),
      reviews: z.object({ pendingReviews: z.number(), avgReviewTimeHours: z.number() }),
    }),
    distributions: z.object({
      submissionsByStatus: z.array(z.object({ status: z.string(), count: z.number() })),
      submissionsByActivity: z.array(z.object({ activity: z.string(), activityName: z.string().optional(), count: z.number() })),
      usersByRole: z.array(z.object({ role: z.string(), count: z.number() })),
      usersByCohort: z.array(z.object({ cohort: z.string().nullable(), count: z.number() })).optional(),
      pointsByActivity: z.array(z.object({ activity: z.string(), activityName: z.string().optional(), totalPoints: z.number(), entries: z.number() })),
      pointsDistribution: z.object({
        totalUsers: z.number(),
        max: z.number(),
        min: z.number(),
        avg: z.number(),
        percentiles: z.array(z.object({ percentile: z.number(), value: z.number() }))
      }).optional(),
    }),
    trends: z.object({
      submissionsByDate: z.array(z.object({ date: z.string(), total: z.number(), approved: z.number(), rejected: z.number(), pending: z.number() })),
      userRegistrationsByDate: z.array(z.object({ date: z.string(), count: z.number() })),
    }),
    recentActivity: z.object({
      submissions: z.array(z.object({
        id: z.string(),
        user: z.object({ name: z.string(), handle: z.string() }),
        activity: z.object({ name: z.string() }),
        status: z.string(),
        created_at: z.string().datetime(),
      })),
      approvals: z.array(z.object({
        id: z.string(),
        user: z.object({ name: z.string(), handle: z.string() }),
        activity: z.object({ name: z.string() }),
        updated_at: z.string().datetime(),
      })),
      users: z.array(z.object({
        id: z.string(),
        name: z.string(),
        handle: z.string(),
        email: z.string(),
        role: z.string(),
        created_at: z.string().datetime(),
      })),
    }),
    performance: z.object({
      reviewers: z.array(z.object({ id: z.string(), name: z.string(), handle: z.string(), role: z.string(), approved: z.number(), rejected: z.number(), total: z.number() })),
      topBadges: z.array(z.object({ badge: z.object({ code: z.string().optional(), name: z.string().optional(), icon_url: z.string().url().nullable().optional() }).passthrough(), earnedCount: z.number() })),
    }),
  })
}).openapi({ 
  title: 'Admin Analytics Response',
  example: {
    success: true,
    data: {
      overview: {
        submissions: { total: 150, pending: 10, approved: 120, rejected: 20, approvalRate: 85.71 },
        users: { total: 1000, active: 650, withSubmissions: 500, withBadges: 200, activationRate: 65 },
        points: { totalAwarded: 50000, totalEntries: 2200, avgPerEntry: 22.73 },
        badges: { totalBadges: 12, totalEarned: 300, uniqueEarners: 250 },
        reviews: { pendingReviews: 10, avgReviewTimeHours: 12.5 }
      },
      distributions: {
        submissionsByStatus: [ { status: 'APPROVED', count: 120 }, { status: 'REJECTED', count: 20 }, { status: 'PENDING', count: 10 } ],
        submissionsByActivity: [ { activity: 'LEARN', activityName: 'Learn', count: 300 } ],
        usersByRole: [ { role: 'PARTICIPANT', count: 900 }, { role: 'REVIEWER', count: 80 }, { role: 'ADMIN', count: 20 } ],
        usersByCohort: [ { cohort: 'Cohort-2024-A', count: 200 } ],
        pointsByActivity: [ { activity: 'LEARN', activityName: 'Learn', totalPoints: 20000, entries: 1000 } ],
        pointsDistribution: { totalUsers: 1000, max: 500, min: 0, avg: 50, percentiles: [ { percentile: 50, value: 45 } ] }
      },
      trends: {
        submissionsByDate: [ { date: '2024-01-10', total: 20, approved: 15, rejected: 3, pending: 2 } ],
        userRegistrationsByDate: [ { date: '2024-01-10', count: 35 } ]
      },
      recentActivity: { submissions: [], approvals: [], users: [] },
      performance: { reviewers: [ { id: 'r1', name: 'Reviewer A', handle: 'rev_a', role: 'REVIEWER', approved: 50, rejected: 10, total: 60 } ], topBadges: [] }
    }
  }
})

export const AdminKajabiResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    events: z.array(z.object({
      id: z.string(),
      received_at: z.string().datetime(),
      processed_at: z.string().datetime().nullable(),
      user_match: z.string().nullable(),
      payload: KajabiTagEventSchema.openapi({
        description: 'Kajabi webhook event payload'
      }),
    })),
    stats: z.object({
      total_events: z.number(),
      processed_events: z.number(),
      matched_users: z.number(),
      unmatched_events: z.number(),
      points_awarded: z.number(),
    })
  })
}).openapi({ 
  title: 'Admin Kajabi Response',
  example: {
    success: true,
    data: {
      events: [ { id: 'test_123', received_at: '2024-02-01T10:00:00Z', processed_at: '2024-02-01T10:01:00Z', user_match: 'user_123', payload: { event_type: 'contact.tagged', data: { tag: { name: 'LEARN_COMPLETED' } } } } ],
      stats: { total_events: 10, processed_events: 8, matched_users: 7, unmatched_events: 3, points_awarded: 160 }
    }
  }
})

export const AdminCohortsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ cohorts: z.array(z.string()) })
}).openapi({ 
  title: 'Admin Cohorts Response',
  example: { success: true, data: { cohorts: ['Cohort-2024-A', 'Cohort-2024-B'] } }
})

export const ErrorResponseSchema = z
  .object({
    success: z.literal(false).openapi({ description: 'Operation failed', example: false }),
    error: z.string().openapi({
      description: 'Error message',
      example: 'Invalid submission data',
    }),
    details: z.array(z.unknown()).optional().openapi({
      description: 'Additional error details (validation errors)',
    }),
  })
  .openapi({
    title: 'Error Response',
    description: 'Standard error response format',
  });

export const SuccessResponseSchema = z
  .object({
    success: z.boolean().openapi({
      description: 'Operation success status',
      example: true,
    }),
    data: z.unknown().optional().openapi({
      description: 'Response data (varies by endpoint)',
    }),
  })
  .openapi({
    title: 'Success Response',
    description: 'Standard success response format',
  });
