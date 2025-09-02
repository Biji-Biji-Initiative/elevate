import React from 'react'
import { clsx } from 'clsx'

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'primary' | 'secondary' | 'white' | 'current'
  className?: string
  text?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ 
  size = 'md', 
  variant = 'primary',
  className,
  text,
  fullScreen = false
}: LoadingSpinnerProps) {
  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return 'w-3 h-3'
      case 'sm':
        return 'w-4 h-4'
      case 'lg':
        return 'w-8 h-8'
      case 'xl':
        return 'w-12 h-12'
      case 'md':
      default:
        return 'w-6 h-6'
    }
  }

  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'text-gray-400'
      case 'white':
        return 'text-white'
      case 'current':
        return 'text-current'
      case 'primary':
      default:
        return 'text-blue-600'
    }
  }

  const getBorderClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'border-gray-200 border-t-gray-400'
      case 'white':
        return 'border-white/20 border-t-white'
      case 'current':
        return 'border-current/20 border-t-current'
      case 'primary':
      default:
        return 'border-blue-200 border-t-blue-600'
    }
  }

  const spinner = (
    <div className={clsx(
      'animate-spin rounded-full border-2',
      getSizeClasses(),
      getBorderClasses(),
      className
    )} />
  )

  const content = (
    <div className={clsx(
      'flex items-center justify-center',
      text && 'flex-col space-y-2'
    )}>
      {spinner}
      {text && (
        <div className={clsx(
          'text-sm font-medium',
          getVariantClasses()
        )}>
          {text}
        </div>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    )
  }

  return content
}

// Convenience component for loading states within containers
export function LoadingContainer({ 
  children, 
  loading, 
  text = 'Loading...',
  size = 'lg',
  className 
}: {
  children: React.ReactNode
  loading: boolean
  text?: string
  size?: LoadingSpinnerProps['size']
  className?: string
}) {
  if (loading) {
    return (
      <div className={clsx('flex items-center justify-center py-8', className)}>
        <LoadingSpinner size={size} text={text} />
      </div>
    )
  }

  return <>{children}</>
}

// Convenience component for loading overlays
export function LoadingOverlay({ 
  loading, 
  text = 'Loading...',
  size = 'lg',
  children 
}: {
  loading: boolean
  text?: string
  size?: LoadingSpinnerProps['size']
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      {children}
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
          <LoadingSpinner size={size} text={text} />
        </div>
      )}
    </div>
  )
}

// Simple page loading component
export function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  )
}