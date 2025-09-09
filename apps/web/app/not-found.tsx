import { redirect } from 'next/navigation'

// This handles the root not-found case and redirects to default locale
export default function RootNotFound() {
  redirect('/en')
}