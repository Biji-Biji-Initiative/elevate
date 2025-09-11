'use client'

import React from 'react'

export function LearnPortalLink({ label = 'Open Learn Portal', className = '' }: { label?: string; className?: string }) {
  const portal = process.env.NEXT_PUBLIC_KAJABI_PORTAL_URL || ''
  if (!portal) return null
  return (
    <a
      href={portal}
      target="_blank"
      rel="noopener noreferrer"
      className={className || 'inline-flex items-center px-3 py-2 text-sm rounded border hover:bg-gray-50'}
    >
      {label}
    </a>
  )
}

