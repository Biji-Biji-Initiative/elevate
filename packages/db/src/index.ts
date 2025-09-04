// Export core database functionality
export * from './client'
export * from './utils'
export * from './analytics'
export * from './database-functions'
export * from './logger'

// Export service layer for data access
export * from './services'

// Note: Prisma types are exported from services.ts to maintain type safety
// API routes should use DTO types from @elevate/types instead

// Re-export Prisma namespace for tagged SQL helpers and types
export { Prisma } from '@prisma/client'
export type { Prisma as PrismaTypes } from '@prisma/client'
