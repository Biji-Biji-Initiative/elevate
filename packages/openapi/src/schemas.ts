import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

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

export const ErrorResponseSchema = z
  .object({
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