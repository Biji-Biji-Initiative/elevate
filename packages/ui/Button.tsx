import * as React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }

export function Button({ variant = 'primary', style, ...rest }: Props) {
  const base: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #1d2435',
    background: variant === 'primary' ? '#2563eb' : 'transparent',
    color: variant === 'primary' ? '#fff' : '#e6edf3',
    cursor: 'pointer',
  }
  return <button style={{ ...base, ...style }} {...rest} />
}

