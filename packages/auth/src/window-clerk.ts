// Small helper to safely access Clerk user on the client
// Avoids ad-hoc window typing across apps

export type ClerkUser = {
  id: string
  username?: string | null
  primaryEmailAddress?: { emailAddress?: string | null } | null
  publicMetadata?: { role?: unknown } | null
}

export function getClerkUserFromWindow(): ClerkUser | null {
  if (typeof window === 'undefined') return null
  const w = window as { Clerk?: { user?: ClerkUser } }
  return w.Clerk?.user ?? null
}
