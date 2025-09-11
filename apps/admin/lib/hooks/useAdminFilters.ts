import { useCallback, useMemo, useState } from 'react'

export function useAdminFilters<T extends Record<string, unknown>>(initial: T) {
  const [filters, setFilters] = useState<T>(initial)

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const reset = useCallback(() => setFilters(initial), [initial])

  return useMemo(() => ({ filters, setFilters, setFilter, reset }), [filters, reset, setFilter])
}

