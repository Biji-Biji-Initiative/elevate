import { useCallback, useMemo, useState } from 'react'

export function useSelection<Id extends string | number>() {
  const [selected, setSelected] = useState<Set<Id>>(new Set())

  const toggle = useCallback((id: Id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const setAll = useCallback((ids: Id[]) => setSelected(new Set(ids)), [])

  const api = useMemo(
    () => ({ selected, setSelected, toggle, clear, setAll }),
    [selected, toggle, clear, setAll],
  )
  return api
}

