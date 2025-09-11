'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentLocale } from '@elevate/ui/next'

import type { MeProfile } from '@/lib/educator-guard'
import { safeJsonParse } from '@/lib/utils/safe-json'

export function useEducatorGuard() {
  const router = useRouter()
  const { withLocale } = useCurrentLocale()

  useEffect(() => {
    const run = async () => {
      let me: MeProfile | null = null
      try {
        const res = await fetch('/api/profile/me', { cache: 'no-store' })
        if (res.ok) {
          const text = await res.text()
          // Safe parse response envelope; tolerate missing data field
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
          const parsed = safeJsonParse<{ data?: MeProfile }>(text)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const dataTyped: MeProfile | undefined = (parsed as { data?: MeProfile } | undefined)?.data
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          me = dataTyped ?? null
        }
      } catch {
        me = null
      }
      // Compute redirect path strictly via local logic
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const path: string | null = (me as MeProfile | null)?.userType === 'STUDENT'
        ? '/educators-only'
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        : ((me as MeProfile | null)?.userType === 'EDUCATOR' && (me as MeProfile | null)?.userTypeConfirmed === false ? '/onboarding/user-type' : null)
      if (typeof path === 'string') router.push(withLocale(path))
    }
    void run()
  }, [router, withLocale])
}
