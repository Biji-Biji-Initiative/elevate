import './globals.css'

export const metadata = {
  title: '@elevate Consumer Test - Next.js 15',
  description: 'Testing @elevate package imports in Next.js 15',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}