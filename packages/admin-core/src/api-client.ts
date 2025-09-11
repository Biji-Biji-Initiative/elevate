import type { paths } from '@elevate/openapi/client'

export type ApiClientOptions = {
  baseUrl?: string
  token?: string
}

/**
 * Minimal typed Admin API client used by admin-core actions.
 * Avoids hard dependency on Next/Clerk and the OpenAPI SDK runtime.
 */
export class AdminApiClient {
  private baseUrl: string
  private token?: string

  constructor(opts: ApiClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
    this.token = opts.token
  }

  setToken(token?: string) {
    this.token = token
  }

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private buildUrl(path: string): string {
    try {
      // Absolute URL if baseUrl provided
      if (this.baseUrl) {
        return new URL(path, this.baseUrl).toString()
      }
    } catch {
      // Fallback to path as-is
    }
    return path
  }

  private buildHeaders(init?: HeadersInit): HeadersInit {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(init as Record<string, string> | undefined),
    }
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`
    }
    return headers
  }

  private async request<T = unknown>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const url = this.buildUrl(path)
    const res = await fetch(url, {
      ...init,
      headers: this.buildHeaders(init?.headers),
    })

    const text = await res.text()
    let data: unknown
    try {
      data = text ? JSON.parse(text) : undefined
    } catch {
      // Non-JSON response
      data = text
    }

    if (!res.ok) {
      // Return the parsed body so callers can zod-parse error envelopes
      throw Object.assign(new Error(`HTTP ${res.status}`), {
        status: res.status,
        data,
      })
    }

    return data as T
  }

  // ----- Admin endpoints -----

  async getAdminCohorts() {
    return this.request<
      paths['/api/admin/meta/cohorts']['get']['responses']['200']['content']['application/json']
    >('/api/admin/meta/cohorts')
  }

  async getAdminSubmissions(
    params?: paths['/api/admin/submissions']['get']['parameters']['query'],
  ) {
    const search = new URLSearchParams()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) search.append(k, String(v))
      }
    }
    const qs = search.toString()
    const endpoint = `/api/admin/submissions${qs ? `?${qs}` : ''}`
    return this.request<
      paths['/api/admin/submissions']['get']['responses']['200']['content']['application/json']
    >(endpoint)
  }

  async getAdminSubmissionById(id: string) {
    return this.request<
      paths['/api/admin/submissions/{id}']['get']['responses']['200']['content']['application/json']
    >(`/api/admin/submissions/${encodeURIComponent(id)}`)
  }

  async reviewSubmission(
    body: NonNullable<
      paths['/api/admin/submissions']['patch']['requestBody']
    >['content']['application/json'],
  ) {
    return this.request<
      paths['/api/admin/submissions']['patch']['responses']['200']['content']['application/json']
    >('/api/admin/submissions', { method: 'PATCH', body: JSON.stringify(body) })
  }

  async bulkReview(
    body: NonNullable<
      paths['/api/admin/submissions']['post']['requestBody']
    >['content']['application/json'],
  ) {
    return this.request<
      paths['/api/admin/submissions']['post']['responses']['200']['content']['application/json']
    >('/api/admin/submissions', { method: 'POST', body: JSON.stringify(body) })
  }

  async getAdminUsers(
    params?: paths['/api/admin/users']['get']['parameters']['query'],
  ) {
    const search = new URLSearchParams()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) search.append(k, String(v))
      }
    }
    const qs = search.toString()
    const endpoint = `/api/admin/users${qs ? `?${qs}` : ''}`
    return this.request<
      paths['/api/admin/users']['get']['responses']['200']['content']['application/json']
    >(endpoint)
  }

  async updateAdminUser(
    body: NonNullable<
      paths['/api/admin/users']['patch']['requestBody']
    >['content']['application/json'],
  ) {
    return this.request<
      paths['/api/admin/users']['patch']['responses']['200']['content']['application/json']
    >('/api/admin/users', { method: 'PATCH', body: JSON.stringify(body) })
  }

  async bulkUpdateAdminUsers(
    body: NonNullable<
      paths['/api/admin/users']['post']['requestBody']
    >['content']['application/json'],
  ) {
    return this.request<
      paths['/api/admin/users']['post']['responses']['200']['content']['application/json']
    >('/api/admin/users', { method: 'POST', body: JSON.stringify(body) })
  }

  async getAdminBadges(
    params?: paths['/api/admin/badges']['get']['parameters']['query'],
  ) {
    const search = new URLSearchParams()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) search.append(k, String(v))
      }
    }
    const qs = search.toString()
    const endpoint = `/api/admin/badges${qs ? `?${qs}` : ''}`
    return this.request<
      paths['/api/admin/badges']['get']['responses']['200']['content']['application/json']
    >(endpoint)
  }

  async createAdminBadge(
    body: NonNullable<
      paths['/api/admin/badges']['post']['requestBody']
    >['content']['application/json'],
  ) {
    return this.request<
      paths['/api/admin/badges']['post']['responses']['200']['content']['application/json']
    >('/api/admin/badges', { method: 'POST', body: JSON.stringify(body) })
  }

  async updateAdminBadge(
    body: NonNullable<
      paths['/api/admin/badges']['patch']['requestBody']
    >['content']['application/json'],
  ) {
    return this.request<
      paths['/api/admin/badges']['patch']['responses']['200']['content']['application/json']
    >('/api/admin/badges', { method: 'PATCH', body: JSON.stringify(body) })
  }

  async deleteAdminBadge(code: string) {
    return this.request<
      paths['/api/admin/badges']['delete']['responses']['200']['content']['application/json']
    >(`/api/admin/badges?code=${encodeURIComponent(code)}`, {
      method: 'DELETE',
    })
  }

  async assignAdminBadge(
    body: NonNullable<
      paths['/api/admin/badges/assign']['post']['requestBody']
    >['content']['application/json'],
  ) {
    return this.request<
      paths['/api/admin/badges/assign']['post']['responses']['200']['content']['application/json']
    >('/api/admin/badges/assign', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async removeAdminBadge(
    body: NonNullable<
      paths['/api/admin/badges/assign']['delete']['requestBody']
    >['content']['application/json'],
  ) {
    return this.request<
      paths['/api/admin/badges/assign']['delete']['responses']['200']['content']['application/json']
    >('/api/admin/badges/assign', {
      method: 'DELETE',
      body: JSON.stringify(body),
    })
  }

  async getAdminAnalytics(
    params?: paths['/api/admin/analytics']['get']['parameters']['query'],
  ) {
    const search = new URLSearchParams()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) search.append(k, String(v))
      }
    }
    const qs = search.toString()
    const endpoint = `/api/admin/analytics${qs ? `?${qs}` : ''}`
    return this.request<
      paths['/api/admin/analytics']['get']['responses']['200']['content']['application/json']
    >(endpoint)
  }

  async getAdminKajabi() {
    return this.request<
      paths['/api/admin/kajabi']['get']['responses']['200']['content']['application/json']
    >('/api/admin/kajabi')
  }

  async testAdminKajabi(
    body: NonNullable<
      paths['/api/admin/kajabi/test']['post']['requestBody']
    >['content']['application/json'],
  ) {
    return this.request<
      paths['/api/admin/kajabi/test']['post']['responses']['200']['content']['application/json']
    >('/api/admin/kajabi/test', { method: 'POST', body: JSON.stringify(body) })
  }

  async reprocessAdminKajabi(
    body: NonNullable<
      paths['/api/admin/kajabi/reprocess']['post']['requestBody']
    >['content']['application/json'],
  ) {
    return this.request<
      paths['/api/admin/kajabi/reprocess']['post']['responses']['200']['content']['application/json']
    >('/api/admin/kajabi/reprocess', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async getAdminKajabiHealth() {
    return this.request<
      paths['/api/admin/kajabi/health']['get']['responses']['200']['content']['application/json']
    >('/api/admin/kajabi/health')
  }

  // ----- New: Admin user detail endpoints -----
  async getAdminUserById(id: string) {
    return this.request<unknown>(`/api/admin/users/${encodeURIComponent(id)}`)
  }

  async patchAdminUserById(
    id: string,
    body: { userType?: 'EDUCATOR' | 'STUDENT'; userTypeConfirmed?: boolean; school?: string; region?: string },
  ) {
    return this.request<unknown>(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  }

  async postAdminKajabiInvite(
    body: NonNullable<
      paths['/api/admin/kajabi/invite']['post']['requestBody']
    >['content']['application/json'],
  ) {
    return this.request<
      paths['/api/admin/kajabi/invite']['post']['responses']['200']['content']['application/json']
    >('/api/admin/kajabi/invite', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async postAdminStorageRetention(
    body: NonNullable<
      paths['/api/admin/storage/retention']['post']['requestBody']
    >['content']['application/json'],
  ) {
    return this.request<
      paths['/api/admin/storage/retention']['post']['responses']['200']['content']['application/json']
    >('/api/admin/storage/retention', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  // Bulk LEAPS update
  async postAdminUsersLeaps(
    body: { userIds: string[]; userType?: 'EDUCATOR' | 'STUDENT'; userTypeConfirmed?: boolean; school?: string; region?: string },
  ) {
    return this.request<unknown>('/api/admin/users/leaps', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
}

// Auth token provider (pluggable to avoid hard dependency on Clerk in libraries)
// Intentionally no server-only imports here. Authentication is provided by
// cookies via middleware; client code should not attempt to fetch server tokens.
