// Main exports for the OpenAPI package
export { openApiSpec as spec } from './spec.js';
export * from './schemas.js';

// Re-export commonly used types
export type {
  LearnInput,
  ExploreInput,
  AmplifyInput,
  PresentInput,
  ShineInput,
} from '@elevate/types/schemas';

// Type helpers for API responses
export type APIResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown[];
};

export type PaginatedResponse<T = unknown> = APIResponse<T[]> & {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

// Common API error types
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown[]
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: unknown[], traceId?: string) {
    super(message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class ForbiddenError extends APIError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class RateLimitError extends APIError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}