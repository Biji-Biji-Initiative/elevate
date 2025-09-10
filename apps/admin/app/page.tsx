import { redirect } from 'next/navigation'

export default function AdminRootPage() {
  // Redirect to the default locale (English) admin dashboard
  redirect('/en')
}
