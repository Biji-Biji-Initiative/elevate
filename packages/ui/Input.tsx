import * as React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error = false, className = '', ...props }: InputProps) {
  const baseStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: error ? '1px solid #dc2626' : '1px solid #26314b',
    outline: 'none',
  }

  const focusStyle = error 
    ? { boxShadow: '0 0 0 1px #dc2626' }
    : { boxShadow: '0 0 0 1px #3b82f6' }

  return (
    <input 
      style={baseStyle} 
      className={className}
      onFocus={(e) => {
        Object.assign(e.target.style, focusStyle)
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        e.target.style.boxShadow = 'none'
        props.onBlur?.(e)
      }}
      {...props} 
    />
  )
}

