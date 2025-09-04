#!/usr/bin/env node
/**
 * TypeScript SDK generator for MS Elevate LEAPS Tracker API
 *
 * Generates type-safe API client and usage examples from OpenAPI spec
 */

import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Ensure src directory exists for SDK and client types
const srcDir = resolve(__dirname, '../src')
mkdirSync(srcDir, { recursive: true })

// Read the generated TypeScript types (from src)
const clientTypesPath = resolve(srcDir, 'client.ts')
const clientTypes = readFileSync(clientTypesPath, 'utf-8')

// Generate a comprehensive TypeScript client SDK
const clientSdk =
  clientTypes +
  `

import { mergeHeaders, addAuthHeader, type ApiSuccess } from '@elevate/types';
import { APIError } from '@elevate/types/errors';
// Import DTO types for request/response convenience
import type {
  LearnApiInput,
  ExploreApiInput,
  AmplifyApiInput,
  PresentApiInput,
  ShineApiInput,
} from '@elevate/types/submission-payloads.api';
import { StatsResponseDTOSchema, StageMetricsDTOSchema, AdminAnalyticsDTOSchema, type StatsResponseDTO, type StageMetricsDTO, type AdminAnalyticsDTO } from '@elevate/types/dto-mappers';
import { SafeDashboardDataSchema, type SafeDashboardData } from '@elevate/types/ui-types';

// API Client SDK
export class ElevateAPIClient {
  private baseUrl: string;
  private token?: string;

  constructor(config: { baseUrl?: string; token?: string } = {}) {
    this.baseUrl = config.baseUrl ?? 'https://leaps.mereka.org';
    if (config.token) {
      this.token = config.token;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = ` +
  '`${this.baseUrl}${endpoint}`' +
  `;
    
    // Type-safe header merging
    let headers = mergeHeaders(
      { 'Content-Type': 'application/json' },
      options.headers
    );

    if (this.token) {
      headers = addAuthHeader(headers, this.token);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const fallback = { error: 'Request failed' } as const;
      const parsed = await response
        .json()
        .catch(() => fallback) as { error?: string; details?: unknown };
      throw new APIError(parsed.error ?? 'Request failed', response.status, parsed.details !== undefined ? (Array.isArray(parsed.details) ? parsed.details : [parsed.details]) : undefined);
    }

    return response.json() as Promise<T>;
  }

  // Submissions API
  // DTO-friendly body type for submission creation
  // Matches API shape: { activityCode, payload, attachments?, visibility? }
  async createSubmission(
    data: {
      activityCode: ActivityCode;
      payload: LearnApiInput | ExploreApiInput | AmplifyApiInput | PresentApiInput | ShineApiInput;
      attachments?: string[];
      visibility?: 'PUBLIC' | 'PRIVATE';
    }
  ) {
    return this.request<paths['/api/submissions']['post']['responses']['201']['content']['application/json']>(
      '/api/submissions',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async getSubmissions(params?: paths['/api/submissions']['get']['parameters']['query']) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    
    const queryString = searchParams.toString();
    const endpoint = '/api/submissions' + (queryString ? '?' + queryString : '');
    return this.request<paths['/api/submissions']['get']['responses']['200']['content']['application/json']>(endpoint);
  }

  // Submissions summary convenience method (since current /api/submissions doesn't match full DTO shape)
  async getSubmissionsSummary(
    params?: paths['/api/submissions']['get']['parameters']['query']
  ): Promise<paths['/api/submissions']['get']['responses']['200']['content']['application/json']> {
    // Call the regular method to get submissions summary
    return this.getSubmissions(params);
  }

  // Convenience typed return for submissions list (DTO mapping)
  // Consumers can import SubmissionDTO for stronger typing on mapped results
  // Note: The API response envelope still follows OpenAPI types.

  // File Upload API
  async uploadFile(file: File, activityCode: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('activityCode', activityCode);

    return this.request<paths['/api/files/upload']['post']['responses']['201']['content']['application/json']>(
      '/api/files/upload',
      {
        method: 'POST',
        body: formData,
        headers: {}, // Remove Content-Type header to let browser set it for FormData
      }
    );
  }

  // Leaderboard API
  async getLeaderboard(params?: paths['/api/leaderboard']['get']['parameters']['query']) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    
    const endpoint = ` +
  "`/api/leaderboard${searchParams.toString() ? '?' + searchParams.toString() : ''}`" +
  `;
    return this.request<paths['/api/leaderboard']['get']['responses']['200']['content']['application/json']>(endpoint);
  }

  // Dashboard API
  async getDashboard() {
    return this.request<paths['/api/dashboard']['get']['responses']['200']['content']['application/json']>('/api/dashboard');
  }
  // Typed DTO convenience for dashboard
  async getDashboardDTO(): Promise<ApiSuccess<SafeDashboardData>> {
    const res = await this.request<ApiSuccess<unknown>>('/api/dashboard');
    const parsed = SafeDashboardDataSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new APIError('Invalid dashboard response shape', 500, parsed.error.issues);
    }
    return {
      success: res.success,
      data: parsed.data as SafeDashboardData
    };
  }

  // Public Stats API
  async getStats() {
    return this.request<paths['/api/stats']['get']['responses']['200']['content']['application/json']>('/api/stats');
  }

  // Typed DTO convenience for public stats
  async getStatsDTO(): Promise<ApiSuccess<StatsResponseDTO>> {
    // Call the regular method to get the legacy snake_case response
    const res = await this.getStats();
    
    // Validate and transform the response to DTO format
    const parsed = StatsResponseDTOSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new APIError('Invalid stats response shape', 500, parsed.error.issues);
    }
    
    // Return only the typed success envelope with validated DTO data
    const out: ApiSuccess<StatsResponseDTO> = { success: true, data: parsed.data };
    return out;
  }

  // Public Metrics API
  async getMetrics(params: paths['/api/metrics']['get']['parameters']['query']) {
    const searchParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined) searchParams.append(key, String(value));
    });
    const endpoint = ` +
  "`/api/metrics${searchParams.toString() ? '?' + searchParams.toString() : ''}`" +
  `;
    return this.request<paths['/api/metrics']['get']['responses']['200']['content']['application/json']>(endpoint);
  }
  // Typed DTO convenience for metrics (stage view)
  async getMetricsDTO(
    params: paths['/api/metrics']['get']['parameters']['query']
  ): Promise<ApiSuccess<StageMetricsDTO>> {
    // Call the regular method to get the legacy snake_case response
    const res = await this.getMetrics(params);
    
    // Validate and transform the response to DTO format
    const parsed = StageMetricsDTOSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new APIError('Invalid metrics response shape', 500, parsed.error.issues);
    }
    
    // Return only the typed success envelope with validated DTO data
    const out: ApiSuccess<StageMetricsDTO> = { success: true, data: parsed.data };
    return out;
  }

  // Public Profile API
  async getProfile(handle: string) {
    return this.request<paths['/api/profile/{handle}']['get']['responses']['200']['content']['application/json']>(
      ` +
  '`/api/profile/${encodeURIComponent(handle)}`' +
  `
    );
  }

  // Health Check API
  async healthCheck() {
    return this.request<paths['/api/health']['get']['responses']['200']['content']['application/json']>('/api/health');
  }

  // Admin APIs (require appropriate permissions)
  async getAdminSubmissions(params?: paths['/api/admin/submissions']['get']['parameters']['query']) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    
    const endpoint = ` +
  "`/api/admin/submissions${searchParams.toString() ? '?' + searchParams.toString() : ''}`" +
  `;
    return this.request<paths['/api/admin/submissions']['get']['responses']['200']['content']['application/json']>(endpoint);
  }

  async getAdminSubmissionById(id: string) {
    const endpoint = ` +
  '`/api/admin/submissions/${encodeURIComponent(id)}`' +
  `;
    return this.request<paths['/api/admin/submissions/{id}']['get']['responses']['200']['content']['application/json']>(endpoint);
  }

  async reviewSubmission(body: NonNullable<paths['/api/admin/submissions']['patch']['requestBody']>['content']['application/json']) {
    return this.request<paths['/api/admin/submissions']['patch']['responses']['200']['content']['application/json']>(
      '/api/admin/submissions',
      { method: 'PATCH', body: JSON.stringify(body) }
    );
  }

  async bulkReview(body: NonNullable<paths['/api/admin/submissions']['post']['requestBody']>['content']['application/json']) {
    return this.request<paths['/api/admin/submissions']['post']['responses']['200']['content']['application/json']>(
      '/api/admin/submissions',
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  async getAdminUsers(params?: paths['/api/admin/users']['get']['parameters']['query']) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const endpoint = ` +
  "`/api/admin/users${searchParams.toString() ? '?' + searchParams.toString() : ''}`" +
  `;
    return this.request<paths['/api/admin/users']['get']['responses']['200']['content']['application/json']>(endpoint);
  }

  async updateAdminUser(body: NonNullable<paths['/api/admin/users']['patch']['requestBody']>['content']['application/json']) {
    return this.request<paths['/api/admin/users']['patch']['responses']['200']['content']['application/json']>(
      '/api/admin/users',
      { method: 'PATCH', body: JSON.stringify(body) }
    );
  }

  async bulkUpdateAdminUsers(body: NonNullable<paths['/api/admin/users']['post']['requestBody']>['content']['application/json']) {
    return this.request<paths['/api/admin/users']['post']['responses']['200']['content']['application/json']>(
      '/api/admin/users',
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  async getAdminBadges(params?: paths['/api/admin/badges']['get']['parameters']['query']) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const endpoint = ` +
  "`/api/admin/badges${searchParams.toString() ? '?' + searchParams.toString() : ''}`" +
  `;
    return this.request<paths['/api/admin/badges']['get']['responses']['200']['content']['application/json']>(endpoint);
  }

  async createAdminBadge(body: NonNullable<paths['/api/admin/badges']['post']['requestBody']>['content']['application/json']) {
    return this.request<paths['/api/admin/badges']['post']['responses']['200']['content']['application/json']>(
      '/api/admin/badges',
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  async updateAdminBadge(body: NonNullable<paths['/api/admin/badges']['patch']['requestBody']>['content']['application/json']) {
    return this.request<paths['/api/admin/badges']['patch']['responses']['200']['content']['application/json']>(
      '/api/admin/badges',
      { method: 'PATCH', body: JSON.stringify(body) }
    );
  }

  async deleteAdminBadge(code: string) {
    const url = ` +
  '`/api/admin/badges?code=${encodeURIComponent(code)}`' +
  `;
    return this.request<paths['/api/admin/badges']['delete']['responses']['200']['content']['application/json']>(url, { method: 'DELETE' });
  }

  async assignAdminBadge(body: NonNullable<paths['/api/admin/badges/assign']['post']['requestBody']>['content']['application/json']) {
    return this.request<paths['/api/admin/badges/assign']['post']['responses']['200']['content']['application/json']>(
      '/api/admin/badges/assign',
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  async removeAdminBadge(body: NonNullable<paths['/api/admin/badges/assign']['delete']['requestBody']>['content']['application/json']) {
    return this.request<paths['/api/admin/badges/assign']['delete']['responses']['200']['content']['application/json']>(
      '/api/admin/badges/assign',
      { method: 'DELETE', body: JSON.stringify(body) }
    );
  }

  async getAdminAnalytics(params?: paths['/api/admin/analytics']['get']['parameters']['query']) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const endpoint = ` +
  "`/api/admin/analytics${searchParams.toString() ? '?' + searchParams.toString() : ''}`" +
  `;
    return this.request<paths['/api/admin/analytics']['get']['responses']['200']['content']['application/json']>(endpoint);
  }
  // Typed DTO convenience for admin analytics
  async getAdminAnalyticsDTO(
    params?: paths['/api/admin/analytics']['get']['parameters']['query']
  ): Promise<ApiSuccess<AdminAnalyticsDTO>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const endpoint = ` +
  "`/api/admin/analytics${searchParams.toString() ? '?' + searchParams.toString() : ''}`" +
  `;
    const res = await this.request<ApiSuccess<unknown>>(endpoint);
    const parsed = AdminAnalyticsDTOSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new APIError('Invalid admin analytics response shape', 500, parsed.error.issues);
    }
    return {
      success: res.success,
      data: parsed.data
    };
  }

  async getAdminCohorts() {
    return this.request<paths['/api/admin/meta/cohorts']['get']['responses']['200']['content']['application/json']>(
      '/api/admin/meta/cohorts'
    );
  }

  async getAdminKajabi() {
    return this.request<paths['/api/admin/kajabi']['get']['responses']['200']['content']['application/json']>(
      '/api/admin/kajabi'
    );
  }

  async testAdminKajabi(body: NonNullable<paths['/api/admin/kajabi/test']['post']['requestBody']>['content']['application/json']) {
    return this.request<paths['/api/admin/kajabi/test']['post']['responses']['200']['content']['application/json']>(
      '/api/admin/kajabi/test',
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  async reprocessAdminKajabi(body: NonNullable<paths['/api/admin/kajabi/reprocess']['post']['requestBody']>['content']['application/json']) {
    return this.request<paths['/api/admin/kajabi/reprocess']['post']['responses']['200']['content']['application/json']>(
      '/api/admin/kajabi/reprocess',
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  // Utility methods
  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    delete this.token;
  }

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
}

// Error classes are imported from @elevate/types/errors - no local definitions needed
// Export them for backwards compatibility
export {
  APIError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  RateLimitError
} from '@elevate/types/errors';

// Type helpers
export type SubmissionPayload = 
  | components['schemas']['LearnSubmission']
  | components['schemas']['ExploreSubmission'] 
  | components['schemas']['AmplifySubmission']
  | components['schemas']['PresentSubmission']
  | components['schemas']['ShineSubmission'];

export type ActivityCode = components['schemas']['ActivityCode'];
export type SubmissionStatus = components['schemas']['SubmissionStatus'];
export type Visibility = components['schemas']['Visibility'];

// Default export
export default ElevateAPIClient;
// Re-export common DTOs for convenience
// Types re-export intentionally omitted in generated SDK
`

// Write the SDK to file
const sdkPath = resolve(srcDir, 'sdk.ts')
writeFileSync(sdkPath, clientSdk, 'utf-8')

console.log(`✅ TypeScript SDK generated: ${sdkPath}`)
console.log('📚 SDK includes:')
console.log('   - Type-safe API client class')
console.log('   - Error handling with custom error classes')
console.log('   - Complete method coverage for all endpoints')
console.log('   - TypeScript intellisense support')
console.log('   - Automatic request/response typing')

// Generate usage examples
const examplesPath = resolve(srcDir, 'examples.ts')
const examples =
  `// MS Elevate LEAPS API - Usage Examples

import ElevateAPIClient from './sdk';
import { 
  APIError, 
  ValidationError,
  AuthenticationError,
  ForbiddenError
} from '@elevate/types/errors';

// Initialize the client
const api = new ElevateAPIClient({
  baseUrl: 'https://leaps.mereka.org', // or http://localhost:3000 for development
  token: 'your-clerk-jwt-token'
});

// Example 1: Create a Learn submission
async function _createLearnSubmission() {
  try {
    const submission = await api.createSubmission({
      activityCode: 'LEARN',
      payload: {
        provider: 'SPL',
        courseName: 'AI for Educators',
        completedAt: new Date().toISOString(),
        certificateUrl: 'https://example.com/certificate.pdf'
      },
      visibility: 'PRIVATE'
    });
    
    console.log('Submission created:', submission.data);
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      console.error('Validation errors:', error.details);
    } else if (error instanceof AuthenticationError) {
      console.error('Authentication required');
    } else if (error instanceof Error) {
      console.error('Submission failed:', error.message);
    } else {
      console.error('Unknown error occurred:', error);
    }
  }
}

// Example 2: Upload evidence file  
async function _uploadEvidence(file: File): Promise<string> {
  try {
    const upload = await api.uploadFile(file, 'EXPLORE');
    console.log('File uploaded:', upload.data);
    return upload.data.path || 'unknown-path';
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Example 3: Get user's dashboard data
async function _getUserDashboard() {
  try {
    const dashboard = await api.getDashboard();
    console.log('User progress:', dashboard.data.progress);
    console.log('Recent submissions:', dashboard.data.recentSubmissions);
  } catch (error) {
    console.error('Dashboard fetch failed:', error);
  }
}

// Example 4: Get leaderboard with search
async function _getTopEducators(searchTerm?: string) {
  try {
    const leaderboard = await api.getLeaderboard({
      period: '30d',
      limit: 10,
      ...(searchTerm && { search: searchTerm })
    });
    
    console.log('Top educators:', leaderboard.data);
    console.log(` +
  '`Total participants: ${leaderboard.total}`' +
  `);
  } catch (error) {
    console.error('Leaderboard fetch failed:', error);
  }
}

// Example 5: Admin - Review submissions
async function _reviewSubmissions() {
  try {
    const submissions = await api.getAdminSubmissions({
      status: 'PENDING',
      limit: 50
    });
    
    console.log(` +
  '`${submissions.data.submissions.length} submissions need review`' +
  `);
    return submissions.data;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      console.error('Admin access required');
      return [];
    } else {
      console.error('Failed to fetch submissions:', error);
      return [];
    }
  }
}

// Example 6: Complete submission workflow
async function _completeExploreSubmission(
  reflectionText: string, 
  evidenceFiles: File[]
) {
  try {
    // 1. Upload evidence files
    const uploadedFiles = await Promise.all(
      evidenceFiles.map(file => _uploadEvidence(file))
    );
    
    // 2. Create submission
    const submission = await api.createSubmission({
      activityCode: 'EXPLORE',
      payload: {
        reflection: reflectionText,
        classDate: new Date().toISOString().split('T')[0] as string,
        school: 'SDN 123 Jakarta',
        evidenceFiles: uploadedFiles
      },
      visibility: 'PUBLIC'
    });
    
    console.log('Explore submission completed:', submission.data);
    return submission.data;
  } catch (error) {
    console.error('Submission workflow failed:', error);
    throw error;
  }
}

// Example 7: Error handling patterns
async function _handleAPIErrors() {
  try {
    await api.createSubmission({
      activityCode: 'LEARN',
      payload: {
        provider: 'SPL',
        courseName: '', // This will cause validation error
        completedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.status) {
        case 400:
          console.error('Bad Request:', error.message);
          if (error.details) {
            console.error('Validation details:', error.details);
          }
          break;
        case 401:
          console.error('Authentication required');
          // Redirect to login or refresh token
          break;
        case 403:
          console.error('Access forbidden');
          break;
        case 429:
          console.error('Rate limit exceeded, try again later');
          break;
        default:
          console.error('API Error:', error.message);
      }
    } else {
      console.error('Network or unknown error:', error);
    }
  }
}

// Example 8: Using with React hooks
/*
import { useState, useEffect } from 'react';

function useLeaderboard(period: '30d' | 'all' = 'all') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getLeaderboard({ period })
      .then(response => {
        setData(response);
        setError(null);
      })
      .catch(err => {
        setError(err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [period]);

  return { data, loading, error };
}
*/

// Example 9: Configuration for different environments
export const createApiClient = (environment: 'development' | 'staging' | 'production') => {
  const configs = {
    development: {
      baseUrl: 'http://localhost:3000',
    },
    staging: {
      baseUrl: 'https://leaps-staging.mereka.org',
    },
    production: {
      baseUrl: 'https://leaps.mereka.org',
    }
  };

  return new ElevateAPIClient(configs[environment]);
};
`

writeFileSync(examplesPath, examples, 'utf-8')

console.log(`✅ Usage examples generated: ${examplesPath}`)
console.log('\n🎯 TypeScript client SDK is ready!')
console.log(
  '   Import: import ElevateAPIClient from "@elevate/openapi/dist/sdk"',
)
console.log('   Types: All endpoints have full TypeScript support')
console.log('   Examples: See dist/examples.ts for usage patterns')
