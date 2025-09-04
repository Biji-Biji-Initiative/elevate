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

  private async request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
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
    return this.request<paths['/api/admin/meta/cohorts']['get']['responses']['200']['content']['application/json']>(
      '/api/admin/meta/cohorts',
    )
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
    return this.request<paths['/api/admin/submissions']['get']['responses']['200']['content']['application/json']>(
      endpoint,
    )
  }

  async getAdminSubmissionById(id: string) {
    return this.request<paths['/api/admin/submissions/{id}']['get']['responses']['200']['content']['application/json']>(
      `/api/admin/submissions/${encodeURIComponent(id)}`,
    )
  }

  async reviewSubmission(
    body: paths['/api/admin/submissions']['patch']['requestBody']['content']['application/json'],
  ) {
    return this.request<paths['/api/admin/submissions']['patch']['responses']['200']['content']['application/json']>(
      '/api/admin/submissions',
      { method: 'PATCH', body: JSON.stringify(body) },
    )
  }

  async bulkReview(
    body: paths['/api/admin/submissions']['post']['requestBody']['content']['application/json'],
  ) {
    return this.request<paths['/api/admin/submissions']['post']['responses']['200']['content']['application/json']>(
      '/api/admin/submissions',
      { method: 'POST', body: JSON.stringify(body) },
    )
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
    return this.request<paths['/api/admin/users']['get']['responses']['200']['content']['application/json']>(
      endpoint,
    )
  }

  async updateAdminUser(
    body: paths['/api/admin/users']['patch']['requestBody']['content']['application/json'],
  ) {
    return this.request<paths['/api/admin/users']['patch']['responses']['200']['content']['application/json']>(
      '/api/admin/users',
      { method: 'PATCH', body: JSON.stringify(body) },
    )
  }

  async bulkUpdateAdminUsers(
    body: paths['/api/admin/users']['post']['requestBody']['content']['application/json'],
  ) {
    return this.request<paths['/api/admin/users']['post']['responses']['200']['content']['application/json']>(
      '/api/admin/users',
      { method: 'POST', body: JSON.stringify(body) },
    )
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
    return this.request<paths['/api/admin/badges']['get']['responses']['200']['content']['application/json']>(
      endpoint,
    )
  }

  async createAdminBadge(
    body: paths['/api/admin/badges']['post']['requestBody']['content']['application/json'],
  ) {
    return this.request<paths['/api/admin/badges']['post']['responses']['200']['content']['application/json']>(
      '/api/admin/badges',
      { method: 'POST', body: JSON.stringify(body) },
    )
  }

  async updateAdminBadge(
    body: paths['/api/admin/badges']['patch']['requestBody']['content']['application/json'],
  ) {
    return this.request<paths['/api/admin/badges']['patch']['responses']['200']['content']['application/json']>(
      '/api/admin/badges',
      { method: 'PATCH', body: JSON.stringify(body) },
    )
  }

  async deleteAdminBadge(code: string) {
    return this.request<paths['/api/admin/badges']['delete']['responses']['200']['content']['application/json']>(
      `/api/admin/badges?code=${encodeURIComponent(code)}`,
      { method: 'DELETE' },
    )
  }

  async assignAdminBadge(
    body: paths['/api/admin/badges/assign']['post']['requestBody']['content']['application/json'],
  ) {
    return this.request<paths['/api/admin/badges/assign']['post']['responses']['200']['content']['application/json']>(
      '/api/admin/badges/assign',
      { method: 'POST', body: JSON.stringify(body) },
    )
  }

  async removeAdminBadge(
    body: paths['/api/admin/badges/assign']['delete']['requestBody']['content']['application/json'],
  ) {
    return this.request<paths['/api/admin/badges/assign']['delete']['responses']['200']['content']['application/json']>(
      '/api/admin/badges/assign',
      { method: 'DELETE', body: JSON.stringify(body) },
    )
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
    return this.request<paths['/api/admin/analytics']['get']['responses']['200']['content']['application/json']>(
      endpoint,
    )
  }

  async getAdminKajabi() {
    return this.request<paths['/api/admin/kajabi']['get']['responses']['200']['content']['application/json']>(
      '/api/admin/kajabi',
    )
  }

  async testAdminKajabi(
    body: paths['/api/admin/kajabi/test']['post']['requestBody']['content']['application/json'],
  ) {
    return this.request<paths['/api/admin/kajabi/test']['post']['responses']['200']['content']['application/json']>(
      '/api/admin/kajabi/test',
      { method: 'POST', body: JSON.stringify(body) },
    )
  }

  async reprocessAdminKajabi(
    body: paths['/api/admin/kajabi/reprocess']['post']['requestBody']['content']['application/json'],
  ) {
    return this.request<paths['/api/admin/kajabi/reprocess']['post']['responses']['200']['content']['application/json']>(
      '/api/admin/kajabi/reprocess',
      { method: 'POST', body: JSON.stringify(body) },
    )
  }
}

// Auth token provider (pluggable to avoid hard dependency on Clerk in libraries)
export type TokenProvider = () => Promise<string | undefined>

export async function getAuthToken(): Promise<string | undefined> {
  // Try dynamic import to avoid static dependency for consumers not using Clerk
  try {
    type ClerkAuth = () => Promise<{ getToken: () => Promise<string | null | undefined> }>
    type ClerkServerModule = { auth?: ClerkAuth }

    // Use a non-literal to avoid ESLint import/no-unresolved on consumers without Clerk
    const clerkSpecifier = '@clerk/nextjs/' + 'server'
    const mod: unknown = await import(clerkSpecifier)
    const maybe = mod as ClerkServerModule
    if (typeof maybe.auth === 'function') {
      const { getToken } = await maybe.auth()
      const token = await getToken()
      return typeof token === 'string' && token.length > 0 ? token : undefined
    }
  } catch {
    // Non-Next/Clerk environment; no token available
  }
  return undefined
}
