'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { withRoleGuard } from '@elevate/auth/context'

function QueuePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/submissions?status=PENDING')
  }, [router])
  return null
}

export default withRoleGuard(QueuePage, ['reviewer', 'admin', 'superadmin'])
