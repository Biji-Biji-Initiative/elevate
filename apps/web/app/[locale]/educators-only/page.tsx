'use client'

import React from 'react'
import Link from 'next/link'
import { SignOutButton } from '@clerk/nextjs'

import { Button, Card } from '@elevate/ui'
import { useCurrentLocale } from '@elevate/ui/next'

export default function EducatorsOnlyPage() {
  const { withLocale } = useCurrentLocale()
  return (
    <main style={{ padding: 24 }}>
      <div className="max-w-xl mx-auto">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-2">Educators Only</h1>
          <p className="text-gray-600 mb-4">
            This portal is for Educators. Student accounts cannot access the LEAPS dashboard or submit activities.
          </p>
          <div className="space-x-3">
            <Link href={withLocale('/account')}>
              <Button variant="ghost">Account Settings</Button>
            </Link>
            <LearnPortalLink />
            <SignOutButton>
              <Button variant="default">Sign out</Button>
            </SignOutButton>
          </div>
        </Card>
      </div>
    </main>
  )
}

function LearnPortalLink() {
  const portal = (typeof window === 'undefined' ? '' : (process.env.NEXT_PUBLIC_KAJABI_PORTAL_URL || ''))
  if (!portal) return null
  return (
    <a href={portal} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-2 text-sm rounded border hover:bg-gray-50">
      Open Learn Portal
    </a>
  )
}
