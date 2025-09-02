import * as React from 'react'
import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  title?: string
  className?: string
  style?: React.CSSProperties
}

export function Card({ children, title, className, style }: CardProps) {
  const defaultCard: React.CSSProperties = {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    backgroundColor: 'white',
    ...style
  }

  return (
    <section 
      className={clsx('border border-gray-200 rounded-xl bg-white', className)}
      style={defaultCard}
    >
      {title ? <h3 className="font-semibold mb-2">{title}</h3> : null}
      {children}
    </section>
  )
}

