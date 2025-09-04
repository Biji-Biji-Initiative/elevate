import Link from 'next/link'

import { Button, Alert, AlertTitle, AlertDescription } from '@elevate/ui'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Alert className="mb-6">
          <AlertTitle>Page Not Found</AlertTitle>
          <AlertDescription>
            The admin page you're looking for doesn't exist or you may not have access to it.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/admin">Back to Admin Dashboard</Link>
          </Button>
          
          <Button asChild variant="outline" className="w-full">
            <Link href="/admin/submissions">View Submissions</Link>
          </Button>
        </div>
        
        <div className="mt-6">
          <p className="text-sm text-gray-500 text-center">
            Make sure you have the correct permissions to access this admin area.
          </p>
        </div>
      </div>
    </div>
  )
}