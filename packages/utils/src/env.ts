/**
 * Environment Variables Runtime Validation
 * MS Elevate LEAPS Tracker - Runtime validation and type-safe environment access
 */

type Environment = 'development' | 'staging' | 'production'
const isProduction = (): boolean => process.env.NODE_ENV === 'production'

// ============================================================================
// VALIDATION ERRORS - Custom error types for environment issues
// ============================================================================

/**
 * Base class for environment-related errors
 */
export class EnvironmentError extends Error {
  constructor(message: string, public code: string, public variable?: string) {
    super(message)
    this.name = 'EnvironmentError'
  }
}

/**
 * Thrown when a required environment variable is missing
 */
export class MissingEnvironmentVariableError extends EnvironmentError {
  constructor(variable: string, environment?: Environment) {
    const envContext = environment ? ` in ${environment} environment` : ''
    super(
      `Missing required environment variable: ${variable}${envContext}`,
      'MISSING_REQUIRED_VAR',
      variable,
    )
    this.name = 'MissingEnvironmentVariableError'
  }
}

/**
 * Thrown when an environment variable has an invalid format
 */
export class InvalidEnvironmentVariableError extends EnvironmentError {
  constructor(variable: string, expected: string, actual?: string) {
    const actualText = actual ? ` (got: ${actual.substring(0, 20)}...)` : ''
    super(
      `Invalid format for environment variable ${variable}: expected ${expected}${actualText}`,
      'INVALID_VAR_FORMAT',
      variable,
    )
    this.name = 'InvalidEnvironmentVariableError'
  }
}

/**
 * Thrown when environment configuration is incomplete
 */
export class IncompleteEnvironmentError extends EnvironmentError {
  constructor(missingVariables: string[], environment?: Environment) {
    const envContext = environment ? ` for ${environment}` : ''
    super(
      `Incomplete environment configuration${envContext}. Missing: ${missingVariables.join(
        ', ',
      )}`,
      'INCOMPLETE_ENV',
    )
    this.name = 'IncompleteEnvironmentError'
  }
}

// ============================================================================
// VALIDATION HELPERS - Core validation functions
// ============================================================================

/**
 * Check if a value appears to be a placeholder
 */
function isPlaceholder(value: string): boolean {
  const placeholderPatterns = [
    'placeholder',
    'your-',
    'replace-me',
    'change-me',
    'example',
    'test_placeholder',
    'demo-',
    'localhost', // Flag localhost URLs as placeholders in production
  ]

  const lowerValue = value.toLowerCase()
  return placeholderPatterns.some((pattern) => lowerValue.includes(pattern))
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validate PostgreSQL connection string format
 */
function isValidPostgresUrl(url: string): boolean {
  const pattern = /^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^?]+(\?.*)?$/
  return pattern.test(url)
}

/**
 * Validate Clerk key format
 */
function isValidClerkKey(
  key: string,
  type: 'publishable' | 'secret' | 'webhook',
): boolean {
  switch (type) {
    case 'publishable':
      return /^pk_(test|live)_[A-Za-z0-9]{24,}$/.test(key)
    case 'secret':
      return /^sk_(test|live)_[A-Za-z0-9]{24,}$/.test(key)
    case 'webhook':
      return /^whsec_[A-Za-z0-9_-]{24,}$/.test(key)
    default:
      return false
  }
}

/**
 * Validate JWT format (for Supabase keys)
 */
function isValidJWT(token: string): boolean {
  const parts = token.split('.')
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return pattern.test(email)
}

// ============================================================================
// TYPE-SAFE GETTERS - Strongly typed environment variable access
// ============================================================================

/**
 * Get a required environment variable with validation
 */
export function getRequiredEnv(
  name: string,
  validator?: (value: string) => boolean,
): string {
  const value = process.env[name]

  if (!value) {
    throw new MissingEnvironmentVariableError(name)
  }

  if (isProduction() && isPlaceholder(value)) {
    throw new InvalidEnvironmentVariableError(
      name,
      'non-placeholder value in production',
      value,
    )
  }

  if (validator && !validator(value)) {
    throw new InvalidEnvironmentVariableError(name, 'valid format')
  }

  return value
}

/**
 * Get an optional environment variable with validation
 */
export function getOptionalEnv(
  name: string,
  defaultValue?: string,
  validator?: (value: string) => boolean,
): string | undefined {
  const value = process.env[name]

  if (!value) {
    return defaultValue
  }

  if (validator && !validator(value)) {
    throw new InvalidEnvironmentVariableError(name, 'valid format')
  }

  return value
}

/**
 * Get a required URL environment variable
 */
export function getRequiredUrl(name: string): string {
  return getRequiredEnv(name, isValidUrl)
}

/**
 * Get an optional URL environment variable
 */
export function getOptionalUrl(
  name: string,
  defaultValue?: string,
): string | undefined {
  return getOptionalEnv(name, defaultValue, isValidUrl)
}

/**
 * Get a required number environment variable
 */
export function getRequiredNumber(name: string): number {
  const value = getRequiredEnv(name, (val) => !isNaN(Number(val)))
  return Number(value)
}

/**
 * Get an optional number environment variable
 */
export function getOptionalNumber(
  name: string,
  defaultValue?: number,
): number | undefined {
  const value = getOptionalEnv(
    name,
    defaultValue?.toString(),
    (val) => !isNaN(Number(val)),
  )
  return value ? Number(value) : undefined
}

/**
 * Get a required boolean environment variable
 */
export function getRequiredBoolean(name: string): boolean {
  const value = getRequiredEnv(name, (val) =>
    ['true', 'false'].includes(val.toLowerCase()),
  )
  return value.toLowerCase() === 'true'
}

/**
 * Get an optional boolean environment variable
 */
export function getOptionalBoolean(
  name: string,
  defaultValue?: boolean,
): boolean | undefined {
  const value = getOptionalEnv(name, defaultValue?.toString(), (val) =>
    ['true', 'false'].includes(val.toLowerCase()),
  )
  return value ? value.toLowerCase() === 'true' : undefined
}

// ============================================================================
// SPECIFIC VALIDATORS - Application-specific validation functions
// ============================================================================

/**
 * Validate critical database environment variables
 */
export function validateDatabaseConfig(): void {
  const databaseUrl = getRequiredEnv('DATABASE_URL', isValidPostgresUrl)
  const directUrl = getRequiredEnv('DIRECT_URL', isValidPostgresUrl)

  // Additional validation for production
  if (isProduction()) {
    if (databaseUrl.includes('localhost') || directUrl.includes('localhost')) {
      throw new InvalidEnvironmentVariableError(
        'DATABASE_URL/DIRECT_URL',
        'non-localhost URL in production',
      )
    }
  }
}

/**
 * Validate Clerk authentication configuration
 */
export function validateClerkConfig(): void {
  const publishableKey = getRequiredEnv(
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    (val) => isValidClerkKey(val, 'publishable'),
  )

  const secretKey = getRequiredEnv('CLERK_SECRET_KEY', (val) =>
    isValidClerkKey(val, 'secret'),
  )

  // Validate webhook secret in production
  if (isProduction()) {
    getRequiredEnv('CLERK_WEBHOOK_SECRET', (val) =>
      isValidClerkKey(val, 'webhook'),
    )
  }

  // Ensure keys match environment (test vs live)
  const isTestPublishable = publishableKey.startsWith('pk_test_')
  const isTestSecret = secretKey.startsWith('sk_test_')

  if (isTestPublishable !== isTestSecret) {
    throw new InvalidEnvironmentVariableError(
      'CLERK_KEYS',
      'publishable and secret keys to match environment (both test or both live)',
    )
  }

  if (isProduction() && (isTestPublishable || isTestSecret)) {
    throw new InvalidEnvironmentVariableError(
      'CLERK_KEYS',
      'live keys in production environment',
    )
  }
}

/**
 * Validate Supabase configuration
 */
export function validateSupabaseConfig(): void {
  const supabaseUrl = getRequiredUrl('NEXT_PUBLIC_SUPABASE_URL')
  getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', isValidJWT)
  getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY', isValidJWT)

  // Ensure URL is a proper Supabase URL
  if (!supabaseUrl.match(/^https:\/\/[a-z0-9]+\.supabase\.co$/)) {
    throw new InvalidEnvironmentVariableError(
      'NEXT_PUBLIC_SUPABASE_URL',
      'valid Supabase project URL (https://project.supabase.co)',
    )
  }
}

/**
 * Validate Kajabi integration configuration (production only)
 */
export function validateKajabiConfig(): void {
  if (!isProduction()) {
    return // Optional in non-production environments
  }

  getRequiredEnv('KAJABI_WEBHOOK_SECRET')
  getRequiredEnv('KAJABI_API_KEY')
  getRequiredEnv('KAJABI_CLIENT_SECRET')
}

/**
 * Validate email configuration
 */
export function validateEmailConfig(): void {
  const fromEmail = getOptionalEnv(
    'FROM_EMAIL',
    'MS Elevate <noreply@leaps.mereka.org>',
  )
  const replyToEmail = getOptionalEnv(
    'REPLY_TO_EMAIL',
    'support@leaps.mereka.org',
  )

  // Extract email from "Name <email>" format
  const extractEmail = (emailString: string): string => {
    const match = emailString.match(/<(.+)>/) || [null, emailString]
    return match[1] || emailString
  }

  if (fromEmail && !isValidEmail(extractEmail(fromEmail))) {
    throw new InvalidEnvironmentVariableError(
      'FROM_EMAIL',
      'valid email address',
    )
  }

  if (replyToEmail && !isValidEmail(extractEmail(replyToEmail))) {
    throw new InvalidEnvironmentVariableError(
      'REPLY_TO_EMAIL',
      'valid email address',
    )
  }
}

// ============================================================================
// COMPREHENSIVE VALIDATION - Full environment validation
// ============================================================================

/**
 * Validate all critical environment variables
 */
export function validateCriticalEnvironment(): void {
  const errors: string[] = []

  try {
    validateDatabaseConfig()
  } catch (error) {
    if (error instanceof EnvironmentError) {
      errors.push(`Database: ${error.message}`)
    }
  }

  try {
    validateClerkConfig()
  } catch (error) {
    if (error instanceof EnvironmentError) {
      errors.push(`Clerk: ${error.message}`)
    }
  }

  try {
    validateSupabaseConfig()
  } catch (error) {
    if (error instanceof EnvironmentError) {
      errors.push(`Supabase: ${error.message}`)
    }
  }

  try {
    getRequiredUrl('NEXT_PUBLIC_SITE_URL')
  } catch (error) {
    if (error instanceof EnvironmentError) {
      errors.push(`Site URL: ${error.message}`)
    }
  }

  try {
    validateEmailConfig()
  } catch (error) {
    if (error instanceof EnvironmentError) {
      errors.push(`Email: ${error.message}`)
    }
  }

  if (errors.length > 0) {
    throw new IncompleteEnvironmentError(errors)
  }
}

/**
 * Validate optional integrations
 */
export function validateOptionalIntegrations(): {
  configured: string[]
  errors: string[]
} {
  const configured: string[] = []
  const errors: string[] = []

  // Kajabi validation
  try {
    validateKajabiConfig()
    configured.push('Kajabi')
  } catch (error) {
    if (error instanceof EnvironmentError && isProduction()) {
      errors.push(`Kajabi: ${error.message}`)
    }
  }

  // Resend validation
  const resendKey = getOptionalEnv('RESEND_API_KEY')
  if (resendKey) {
    if (resendKey.startsWith('re_')) {
      configured.push('Resend')
    } else {
      errors.push('Resend: Invalid API key format')
    }
  }

  // OpenAI validation
  const openaiKey = getOptionalEnv('OPENAI_API_KEY')
  if (openaiKey) {
    if (openaiKey.startsWith('sk-')) {
      configured.push('OpenAI')
    } else {
      errors.push('OpenAI: Invalid API key format')
    }
  }

  // Sentry validation
  const sentryDsn = getOptionalEnv('SENTRY_DSN')
  if (sentryDsn) {
    if (isValidUrl(sentryDsn) && sentryDsn.includes('sentry.io')) {
      configured.push('Sentry')
    } else {
      errors.push('Sentry: Invalid DSN format')
    }
  }

  return { configured, errors }
}

// ============================================================================
// INITIALIZATION HELPER - Early validation for app startup
// ============================================================================

/**
 * Validate environment on application startup
 * Call this early in your application bootstrap process
 */
export function initializeEnvironment(
  options: {
    skipOptional?: boolean
    throwOnError?: boolean
    logger?: (message: string) => void
  } = {},
): void {
  const { skipOptional = false, throwOnError = true, logger } = options
  const log = logger ?? ((_: string) => undefined)

  log(`🔍 Initializing environment validation (${process.env.NODE_ENV})`)

  try {
    // Step 1: Validate critical variables
    validateCriticalEnvironment()
    log('✅ Critical environment variables validated')

    // Step 2: Validate optional integrations if requested
    if (!skipOptional) {
      const { configured, errors } = validateOptionalIntegrations()

      if (configured.length > 0) {
        log(`✅ Configured integrations: ${configured.join(', ')}`)
      }

      if (errors.length > 0) {
        log(`⚠️  Integration warnings: ${errors.length}`)
        if (throwOnError && isProduction()) {
          throw new IncompleteEnvironmentError(errors)
        }
      }
    }

    log('🎯 Environment initialization complete')
  } catch (error) {
    if (error instanceof EnvironmentError) {
      log(`❌ Environment validation failed: ${error.message}`)
      if (throwOnError) {
        throw error
      }
    } else {
      throw error
    }
  }
}

// ============================================================================
// CONFIGURATION OBJECTS - Pre-validated environment access
// ============================================================================

/**
 * Database configuration object with validation
 */
export function getDatabaseConfig() {
  validateDatabaseConfig()
  return {
    url: getRequiredEnv('DATABASE_URL'),
    directUrl: getRequiredEnv('DIRECT_URL'),
    poolMax: getOptionalNumber('DATABASE_POOL_MAX', 10) ?? 10,
    poolTimeout: getOptionalNumber('DATABASE_POOL_TIMEOUT', 30000) ?? 30000,
  }
}

/**
 * Authentication configuration object with validation
 */
export function getAuthConfig() {
  validateClerkConfig()
  return {
    clerk: {
      publishableKey: getRequiredEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'),
      secretKey: getRequiredEnv('CLERK_SECRET_KEY'),
      webhookSecret: getOptionalEnv('CLERK_WEBHOOK_SECRET'),
    },
  }
}

/**
 * Storage configuration object with validation
 */
export function getStorageConfig() {
  validateSupabaseConfig()
  return {
    supabase: {
      url: getRequiredUrl('NEXT_PUBLIC_SUPABASE_URL'),
      anonKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    },
  }
}

/**
 * Application configuration object
 */
export function getAppConfig() {
  return {
    siteUrl: getRequiredUrl('NEXT_PUBLIC_SITE_URL'),
    environment: (process.env.NODE_ENV || 'development') as Environment,
    debug: getOptionalBoolean('DEBUG', false) ?? false,
    rateLimits: {
      api: getOptionalNumber('RATE_LIMIT_RPM', 60) ?? 60,
      webhook: getOptionalNumber('WEBHOOK_RATE_LIMIT_RPM', 120) ?? 120,
    },
    email: {
      from:
        getOptionalEnv('FROM_EMAIL', 'MS Elevate <noreply@leaps.mereka.org>') ??
        'MS Elevate <noreply@leaps.mereka.org>',
      replyTo:
        getOptionalEnv('REPLY_TO_EMAIL', 'support@leaps.mereka.org>') ??
        'support@leaps.mereka.org>',
    },
  }
}

// ============================================================================
// EXPORTS - Public API
// ============================================================================

// Note: All symbols above are already exported at declaration sites. Avoid re-export blocks to prevent duplicate export errors.
