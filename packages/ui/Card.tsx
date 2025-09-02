import * as React from 'react'

export function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  const card: React.CSSProperties = {
    border: '1px solid #1d2435',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  }
  return (
    <section style={card}>
      {title ? <h3>{title}</h3> : null}
      {children}
    </section>
  )
}

