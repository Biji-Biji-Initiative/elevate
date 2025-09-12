'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentLocale } from '@elevate/ui/next'

import { fetchMeProfile, computeEducatorOnlyRedirect } from '@/lib/educator-guard'

export function useEducatorGuard() {
  const router = useRouter()
  const { withLocale } = useCurrentLocale()

  useEffect(() => {
    const run = async () => {
      const me = await fetchMeProfile()
      const path = computeEducatorOnlyRedirect(me)
      if (path) router.push(withLocale(path))
    }
    void run()
  }, [router, withLocale])
}
