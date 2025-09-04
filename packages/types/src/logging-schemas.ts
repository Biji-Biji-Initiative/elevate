import { z } from 'zod'

export const ClientErrorReportSchema = z.object({
  level: z.enum(['error', 'warn', 'info']),
  message: z.string(),
  error: z
    .object({
      name: z.string(),
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
  context: z
    .object({
      url: z.string().optional(),
      userId: z.string().optional(),
      userAgent: z.string().optional(),
      timestamp: z.string().optional(),
      component: z.string().optional(),
      action: z.string().optional(),
      sessionId: z.string().optional(),
      buildId: z.string().optional(),
    })
    .optional(),
})

export type ClientErrorReport = z.infer<typeof ClientErrorReportSchema>

