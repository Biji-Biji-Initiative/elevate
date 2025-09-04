import React from 'react'

export interface StatusBadgeProps {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string
  variant?: 'default' | 'dot'
  size?: 'sm' | 'md' | 'lg'
}

export function StatusBadge({ status, variant = 'default', size = 'md' }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return { color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' }
      case 'APPROVED':
        return { color: 'bg-green-100 text-green-800', dot: 'bg-green-400' }
      case 'REJECTED':
        return { color: 'bg-red-100 text-red-800', dot: 'bg-red-400' }
      case 'PARTICIPANT':
        return { color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-400' }
      case 'REVIEWER':
        return { color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-400' }
      case 'ADMIN':
        return { color: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-400' }
      case 'SUPERADMIN':
        return { color: 'bg-pink-100 text-pink-800', dot: 'bg-pink-400' }
      case 'PUBLIC':
        return { color: 'bg-green-100 text-green-800', dot: 'bg-green-400' }
      case 'PRIVATE':
        return { color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-400' }
      default:
        return { color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-400' }
    }
  }

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs'
      case 'lg':
        return 'px-4 py-2 text-base'
      default:
        return 'px-3 py-1 text-sm'
    }
  }

  const config = getStatusConfig(status)
  const sizeClasses = getSizeClasses(size)

  if (variant === 'dot') {
    return (
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
        <span className="text-sm text-gray-900 capitalize">
          {status.toLowerCase()}
        </span>
      </div>
    )
  }

  return (
    <span className={`
      inline-flex items-center rounded-full font-medium capitalize
      ${config.color} ${sizeClasses}
    `}>
      {status.toLowerCase()}
    </span>
  )
}