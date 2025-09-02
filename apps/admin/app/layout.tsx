import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import { AdminLayout } from '../components/Layout'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'MS Elevate LEAPS Admin',
  description: 'Admin console for MS Elevate LEAPS Tracker',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <AdminLayout>{children}</AdminLayout>
        </body>
      </html>
    </ClerkProvider>
  )
}
