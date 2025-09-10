'use client'

import React from 'react'

import { usePathname } from 'next/navigation'
 
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  const pathname = usePathname()
  const locale = React.useMemo(() => {
    const m = pathname?.match(/^\/(en|id)(\/|$)/)
    return m ? m[1] : 'en'
  }, [pathname])
  const afterSignUpUrl = `/${locale}/onboarding/user-type`
  const afterSignInUrl = `/${locale}/dashboard`
  return (
    <div className="min-h-screen flex items-center justify-center py-8">
      <SignUp afterSignUpUrl={afterSignUpUrl} afterSignInUrl={afterSignInUrl} />
    </div>
  )
}
