import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for could not be found.',
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Page Not Found</h2>
          <p className="text-gray-600 mb-8">
            Sorry, we couldn't find the page you're looking for. It might have been moved, deleted, 
            or you may have entered the wrong URL.
          </p>
        </div>
        
        <div className="space-y-4">
          <Link 
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors w-full"
          >
            Go Home
          </Link>
          
          <Link 
            href="/leaderboard"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors w-full"
          >
            View Leaderboard
          </Link>
        </div>
        
        <div className="mt-8">
          <p className="text-sm text-gray-500">
            Need help? Check out our{' '}
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-500">
              dashboard
            </Link>{' '}
            or{' '}
            <a href="#" className="text-blue-600 hover:text-blue-500">
              contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}