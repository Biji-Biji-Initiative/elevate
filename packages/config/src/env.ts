import { z } from 'zod'

// Enhanced environment schema with strict validation
export const EnvSchema = z.object({
  // Database - Always required
  DATABASE_URL: z.string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
      "DATABASE_URL must be a valid PostgreSQL connection string"
    ),

  // Clerk Authentication - Always required
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string()
    .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required")
    .startsWith("pk_", "Clerk publishable key must start with 'pk_'"),
  
  CLERK_SECRET_KEY: z.string()
    .min(1, "CLERK_SECRET_KEY is required")
    .startsWith("sk_", "Clerk secret key must start with 'sk_'"),

  CLERK_WEBHOOK_SECRET: z.string()
    .min(1, "CLERK_WEBHOOK_SECRET is required for webhook validation")
    .optional(),

  // Supabase Storage - Optional but validated if provided
  NEXT_PUBLIC_SUPABASE_URL: z.string()
    .url("Invalid Supabase URL")
    .refine(
      (url) => url.includes('.supabase.co') || process.env.NODE_ENV === 'development',
      "NEXT_PUBLIC_SUPABASE_URL should be a valid Supabase URL"
    )
    .optional(),
  
  SUPABASE_SERVICE_ROLE_KEY: z.string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required when using Supabase")
    .optional(),

  // Kajabi Integration - Optional but validated if provided
  KAJABI_WEBHOOK_SECRET: z.string()
    .min(16, "KAJABI_WEBHOOK_SECRET must be at least 16 characters for security")
    .optional(),

  KAJABI_API_KEY: z.string().optional(),
  KAJABI_CLIENT_SECRET: z.string().optional(),

  // Application Settings
  NEXT_PUBLIC_SITE_URL: z.string()
    .url("Invalid site URL")
    .default("http://localhost:3000"),

  NODE_ENV: z.enum(["development", "production", "test"])
    .default("development"),

  // Rate Limiting Configuration
  RATE_LIMIT_RPM: z.string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(1000))
    .default("60"),

  WEBHOOK_RATE_LIMIT_RPM: z.string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(1000))
    .default("120"),

  // Optional Services
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  OPENAI_API_KEY: z.string().startsWith("sk-").optional(),
  CRON_SECRET: z.string().min(1).optional(),
  
  // Development/Debug
  DEBUG: z.string()
    .transform((val) => val === 'true' || val === '1')
    .default("false")
    .optional(),

  // Logging Configuration
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default("info")
    .optional(),
  
  LOG_PRETTY: z.string()
    .transform((val) => val === 'true' || val === '1')
    .default("false")
    .optional(),
  
  LOG_REDACT: z.string()
    .default("password,secret,token,key,authorization,auth,cookie,session,apiKey,api_key,client_secret,access_token,refresh_token,jwt,privateKey,private_key,credentials,ssn,social_security,credit_card,card_number,cvv,pin")
    .optional(),

  LOG_NAME: z.string()
    .default("elevate")
    .optional(),

  // Monitoring and Observability
  SENTRY_DSN: z.string().url().optional(),
  LOGTAIL_TOKEN: z.string().optional(),
})

// Web app specific env vars - stricter requirements
export const WebEnvSchema = EnvSchema.extend({
  // Web app requires Supabase for file storage
  NEXT_PUBLIC_SUPABASE_URL: z.string()
    .url("Supabase URL is required for web app")
    .refine(
      (url) => url.includes('.supabase.co') || process.env.NODE_ENV === 'development',
      "NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase URL"
    ),
    
  SUPABASE_SERVICE_ROLE_KEY: z.string()
    .min(1, "Supabase service role key is required for web app")
    .refine(
      (key) => key.startsWith('eyJ') || process.env.NODE_ENV === 'development',
      "SUPABASE_SERVICE_ROLE_KEY should be a valid JWT token"
    ),

  // Web app requires Kajabi integration for webhooks  
  KAJABI_WEBHOOK_SECRET: z.string()
    .min(16, "Kajabi webhook secret is required for web app (min 16 chars)"),

  CLERK_WEBHOOK_SECRET: z.string()
    .min(1, "CLERK_WEBHOOK_SECRET is required for web app webhooks")
    .startsWith("whsec_", "Clerk webhook secret must start with 'whsec_'"),
});

export type WebEnv = z.infer<typeof WebEnvSchema>

// Admin app specific env vars - minimal requirements
export const AdminEnvSchema = EnvSchema.pick({
  DATABASE_URL: true,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: true,
  CLERK_SECRET_KEY: true,
  NEXT_PUBLIC_SITE_URL: true,
  NODE_ENV: true,
  RATE_LIMIT_RPM: true,
  DEBUG: true,
  KAJABI_API_KEY: true,
  KAJABI_CLIENT_SECRET: true,
}).required({
  NODE_ENV: true,
})

// Normalize aliases and environment naming drifts without requiring changes downstream
function withAliases(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    // Support both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_ROLE
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || ('SUPABASE_SERVICE_ROLE' in env ? env.SUPABASE_SERVICE_ROLE : undefined),
  }
}

// Enhanced parsing with detailed error reporting and fail-fast behavior
export function parseEnv<TOutput>(
  env: NodeJS.ProcessEnv,
  schema: z.ZodType<TOutput> = EnvSchema as unknown as z.ZodType<TOutput>,
): TOutput {
  const normalized = withAliases(env)
  
  try {
    const parsed = schema.parse(normalized)
    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Group issues but avoid console side-effects in packages
      const criticalVars = new Set([
        'DATABASE_URL',
        'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
        'CLERK_SECRET_KEY',
      ])
      const criticalErrors: string[] = []
      const warnings: string[] = []
      for (const issue of error.issues) {
        const path = issue.path.join('.')
        const message = `${path}: ${issue.message}`
        if (criticalVars.has(path)) criticalErrors.push(message)
        else warnings.push(message)
      }
      const allErrors = [...criticalErrors, ...warnings]
      throw new Error(
        `Environment validation failed (${allErrors.length} issues). Critical: [${criticalErrors.join(
          '; ',
        )}] Warnings: [${warnings.join('; ')}]`,
      )
    }
    throw error
  }
}

// Helper functions for specific app types with enhanced error handling
export function parseWebEnv(env: NodeJS.ProcessEnv = process.env): WebEnv {
  const parsed = WebEnvSchema.parse(withAliases(env))
  if (parsed.NODE_ENV === 'production') {
    if (!parsed.KAJABI_WEBHOOK_SECRET) {
      throw new Error('KAJABI_WEBHOOK_SECRET is required in production')
    }
    if (!parsed.CLERK_WEBHOOK_SECRET) {
      throw new Error('CLERK_WEBHOOK_SECRET is required in production')
    }
  }
  return parsed
}

export function parseAdminEnv(env: NodeJS.ProcessEnv = process.env): z.infer<typeof AdminEnvSchema> {
  return AdminEnvSchema.parse(env)
}

// Utility function to validate environment at startup  
export function validateEnvOnStartup(appType: 'web' | 'admin' | 'general' = 'general'): WebEnv | z.infer<typeof AdminEnvSchema> | z.infer<typeof EnvSchema> {
  switch (appType) {
    case 'web':
      return parseWebEnv()
    case 'admin':
      return parseAdminEnv()
    default:
      return EnvSchema.parse(process.env)
  }
}
