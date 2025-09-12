// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useEducatorGuard } from '../hooks/useEducatorGuard'

// Mock next/navigation useRouter with exported pushMock for assertions
const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

// Mock useCurrentLocale to return identity withLocale
vi.mock('@elevate/ui/next', () => ({
  useCurrentLocale: () => ({ withLocale: (p: string) => p }),
}))

function HookHost() {
  useEducatorGuard()
  return React.createElement('div')
}

describe('useEducatorGuard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects students to /educators-only', async () => {
    // Mock fetch to return student profile
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: { userType: 'STUDENT', userTypeConfirmed: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(React.createElement(HookHost))
    // Allow effect to run
    await new Promise((r) => setTimeout(r, 0))
    expect(pushMock).toHaveBeenCalledWith('/educators-only')
    root.unmount()
  })

  it('redirects unconfirmed educators to /onboarding/user-type', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: { userType: 'EDUCATOR', userTypeConfirmed: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    pushMock.mockClear()
    root.render(React.createElement(HookHost))
    await new Promise((r) => setTimeout(r, 0))
    expect(pushMock).toHaveBeenCalledWith('/onboarding/user-type')
    root.unmount()
  })

  it('does not redirect for confirmed educators', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: { userType: 'EDUCATOR', userTypeConfirmed: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    pushMock.mockClear()
    root.render(React.createElement(HookHost))
    await new Promise((r) => setTimeout(r, 0))
    expect(pushMock).not.toHaveBeenCalled()
    root.unmount()
  })
})
