import { z } from 'zod'

export const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Invalid Supabase URL").optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  KAJABI_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url("Invalid site URL").default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
})

// Web app specific env vars
export const WebEnvSchema = EnvSchema.extend({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Supabase URL is required for web app"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "Supabase service role key is required for web app"),
  KAJABI_WEBHOOK_SECRET: z.string().min(1, "Kajabi webhook secret is required for web app"),
})

// Admin app specific env vars (no Supabase or Kajabi required)
export const AdminEnvSchema = EnvSchema.omit({
  NEXT_PUBLIC_SUPABASE_URL: true,
  SUPABASE_SERVICE_ROLE_KEY: true,
  KAJABI_WEBHOOK_SECRET: true,
})

export function parseEnv(env: NodeJS.ProcessEnv, schema = EnvSchema) {
  const res = schema.safeParse(env)
  if (!res.success) {
    const issues = res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
    throw new Error(`Invalid env: ${issues}`)
  }
  return res.data
}

// Helper functions for specific app types
export function parseWebEnv(env: NodeJS.ProcessEnv) {
  return parseEnv(env, WebEnvSchema)
}

export function parseAdminEnv(env: NodeJS.ProcessEnv) {
  return parseEnv(env, AdminEnvSchema)
}

