import { useEffect, useState } from 'react'

import { getCohortsAction } from '@/lib/actions/submissions'
import { toMsg } from '@/lib/errors'

export function useCohorts(initial: string[] = []) {
  const [cohorts, setCohorts] = useState<string[]>(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initial.length > 0) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const nextCohorts = await getCohortsAction()
        if (!cancelled) setCohorts(nextCohorts)
      } catch (e: unknown) {
        if (!cancelled) setError(toMsg('Cohort fetch', e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [initial])

  return { cohorts, setCohorts, loading, error }
}
