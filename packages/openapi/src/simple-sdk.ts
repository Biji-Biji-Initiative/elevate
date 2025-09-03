/**
 * Simplified SDK for MS Elevate LEAPS API
 * This avoids TypeScript strict mode issues with generated code
 */

import { mergeHeaders, addAuthHeader } from '@elevate/types/src/http'

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown[];
}

export interface CreateSubmissionRequest {
  activityCode: string;
  payload: Record<string, unknown>;
  attachments?: string[];
  visibility?: 'PUBLIC' | 'PRIVATE';
}

export interface LeaderboardParams {
  period?: 'all' | '30d';
  limit?: number;
  offset?: number;
  search?: string;
}

export interface DashboardData {
  progress: Record<string, unknown>;
  recentSubmissions: unknown[];
}

export interface AdminSubmissionsParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export class ElevateAPIClient {
  private baseUrl: string;
  private token: string | undefined;

  constructor(config: { baseUrl?: string; token?: string } = {}) {
    this.baseUrl = config.baseUrl ?? 'https://leaps.mereka.org';
    this.token = config.token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP ${response.status}`,
          details: data.details,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async createSubmission(request: CreateSubmissionRequest): Promise<APIResponse> {
    return this.request('/api/submissions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async uploadFile(file: File, activityType: string): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('activityType', activityType);

    const headers: HeadersInit = {};
    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/uploads`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async getDashboard(): Promise<APIResponse<DashboardData>> {
    return this.request('/api/dashboard');
  }

  async getLeaderboard(params?: LeaderboardParams): Promise<APIResponse> {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.append('period', params.period);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.search) searchParams.append('search', params.search);

    const query = searchParams.toString();
    const path = query ? `/api/leaderboard?${query}` : '/api/leaderboard';

    return this.request(path);
  }

  async getAdminSubmissions(params?: AdminSubmissionsParams): Promise<APIResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const query = searchParams.toString();
    const path = query ? `/api/admin/submissions?${query}` : '/api/admin/submissions';

    return this.request(path);
  }

  async getAdminCohorts(): Promise<APIResponse> {
    return this.request('/api/admin/meta/cohorts');
  }
}

export default ElevateAPIClient;