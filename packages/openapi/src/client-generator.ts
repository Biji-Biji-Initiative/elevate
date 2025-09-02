#!/usr/bin/env node
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure dist directory exists
const distDir = resolve(__dirname, '../dist');
mkdirSync(distDir, { recursive: true });

// Read the generated TypeScript types
const clientTypesPath = resolve(distDir, 'client.ts');
const clientTypes = readFileSync(clientTypesPath, 'utf-8');

// Generate a comprehensive TypeScript client SDK
const clientSdk = `${clientTypes}

// API Client SDK
export class ElevateAPIClient {
  private baseUrl: string;
  private token?: string;

  constructor(config: { baseUrl?: string; token?: string } = {}) {
    this.baseUrl = config.baseUrl || 'https://leaps.mereka.org';
    this.token = config.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = \`\${this.baseUrl}\${endpoint}\`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = \`Bearer \${this.token}\`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: 'Request failed' 
      }));
      throw new APIError(error.error || 'Request failed', response.status, error.details);
    }

    return response.json();
  }

  // Submissions API
  async createSubmission(data: paths['/api/submissions']['post']['requestBody']['content']['application/json']) {
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
    
    const endpoint = \`/api/submissions\${searchParams.toString() ? '?' + searchParams.toString() : ''}\`;
    return this.request<paths['/api/submissions']['get']['responses']['200']['content']['application/json']>(endpoint);
  }

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
    
    const endpoint = \`/api/leaderboard\${searchParams.toString() ? '?' + searchParams.toString() : ''}\`;
    return this.request<paths['/api/leaderboard']['get']['responses']['200']['content']['application/json']>(endpoint);
  }

  // Dashboard API
  async getDashboard() {
    return this.request<paths['/api/dashboard']['get']['responses']['200']['content']['application/json']>('/api/dashboard');
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
    
    const endpoint = \`/api/admin/submissions\${searchParams.toString() ? '?' + searchParams.toString() : ''}\`;
    return this.request<paths['/api/admin/submissions']['get']['responses']['200']['content']['application/json']>(endpoint);
  }

  // Utility methods
  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = undefined;
  }

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
}

// Error classes
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any[]
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: any[]) {
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
`;

// Write the SDK to file
const sdkPath = resolve(distDir, 'sdk.ts');
writeFileSync(sdkPath, clientSdk, 'utf-8');

console.log(`✅ TypeScript SDK generated: ${sdkPath}`);
console.log('📚 SDK includes:');
console.log('   - Type-safe API client class');
console.log('   - Error handling with custom error classes');
console.log('   - Complete method coverage for all endpoints');
console.log('   - TypeScript intellisense support');
console.log('   - Automatic request/response typing');

// Generate usage examples
const examplesPath = resolve(distDir, 'examples.ts');
const examples = `// MS Elevate LEAPS API - Usage Examples

import ElevateAPIClient, { 
  APIError, 
  ValidationError,
  AuthenticationError 
} from './sdk';

// Initialize the client
const api = new ElevateAPIClient({
  baseUrl: 'https://leaps.mereka.org', // or http://localhost:3000 for development
  token: 'your-clerk-jwt-token'
});

// Example 1: Create a Learn submission
async function createLearnSubmission() {
  try {
    const submission = await api.createSubmission({
      activityCode: 'LEARN',
      payload: {
        provider: 'SPL',
        course: 'AI for Educators',
        completedAt: new Date().toISOString(),
        certificateFile: 'evidence/learn/user123/certificate.pdf'
      },
      visibility: 'PRIVATE'
    });
    
    console.log('Submission created:', submission.data);
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation errors:', error.details);
    } else if (error instanceof AuthenticationError) {
      console.error('Authentication required');
    } else {
      console.error('Submission failed:', error.message);
    }
  }
}

// Example 2: Upload evidence file
async function uploadEvidence(file: File) {
  try {
    const upload = await api.uploadFile(file, 'EXPLORE');
    console.log('File uploaded:', upload.data);
    return upload.data.path;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Example 3: Get user's dashboard data
async function getUserDashboard() {
  try {
    const dashboard = await api.getDashboard();
    console.log('User progress:', dashboard.data.progress);
    console.log('Recent submissions:', dashboard.data.recentSubmissions);
  } catch (error) {
    console.error('Dashboard fetch failed:', error);
  }
}

// Example 4: Get leaderboard with search
async function getTopEducators(searchTerm?: string) {
  try {
    const leaderboard = await api.getLeaderboard({
      period: '30d',
      limit: 10,
      search: searchTerm
    });
    
    console.log('Top educators:', leaderboard.data);
    console.log(\`Total participants: \${leaderboard.total}\`);
  } catch (error) {
    console.error('Leaderboard fetch failed:', error);
  }
}

// Example 5: Admin - Review submissions
async function reviewSubmissions() {
  try {
    const submissions = await api.getAdminSubmissions({
      status: 'PENDING',
      limit: 50
    });
    
    console.log(\`\${submissions.data.length} submissions need review\`);
    return submissions.data;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      console.error('Admin access required');
    } else {
      console.error('Failed to fetch submissions:', error);
    }
  }
}

// Example 6: Complete submission workflow
async function completeExploreSubmission(
  reflectionText: string, 
  evidenceFiles: File[]
) {
  try {
    // 1. Upload evidence files
    const uploadedFiles = await Promise.all(
      evidenceFiles.map(file => uploadEvidence(file))
    );
    
    // 2. Create submission
    const submission = await api.createSubmission({
      activityCode: 'EXPLORE',
      payload: {
        reflection: reflectionText,
        classDate: new Date().toISOString().split('T')[0],
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
async function handleAPIErrors() {
  try {
    await api.createSubmission({
      activityCode: 'LEARN',
      payload: {
        provider: 'SPL',
        course: '', // This will cause validation error
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
`;

writeFileSync(examplesPath, examples, 'utf-8');

console.log(`✅ Usage examples generated: ${examplesPath}`);
console.log('\n🎯 TypeScript client SDK is ready!');
console.log('   Import: import ElevateAPIClient from "@elevate/openapi/dist/sdk"');
console.log('   Types: All endpoints have full TypeScript support');
console.log('   Examples: See dist/examples.ts for usage patterns');