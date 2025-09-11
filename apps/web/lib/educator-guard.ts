export type MeProfile = { userType?: 'EDUCATOR' | 'STUDENT'; userTypeConfirmed?: boolean }

export function computeEducatorOnlyRedirect(me?: MeProfile | null): '/educators-only' | '/onboarding/user-type' | null {
  if (!me || typeof me !== 'object') return null
  if (me.userType === 'STUDENT') return '/educators-only'
  if (me.userType === 'EDUCATOR' && me.userTypeConfirmed === false) return '/onboarding/user-type'
  return null
}

export async function fetchMeProfile(): Promise<MeProfile | null> {
  try {
    const res = await fetch('/api/profile/me')
    if (!res.ok) return null
    const json = (await res.json()) as { data?: MeProfile }
    return json?.data ?? null
  } catch {
    return null
  }
}

