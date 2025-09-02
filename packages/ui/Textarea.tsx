import * as React from 'react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function Textarea({ error = false, className = '', ...props }: TextareaProps) {
  const baseStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: error ? '1px solid #dc2626' : '1px solid #26314b',
    outline: 'none',
    minHeight: '80px',
    resize: 'vertical',
  }

  const focusStyle = error 
    ? { boxShadow: '0 0 0 1px #dc2626' }
    : { boxShadow: '0 0 0 1px #3b82f6' }

  return (
    <textarea 
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

