import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="text-xl font-bold">MS Elevate</div>
            <p className="text-gray-400 text-sm">
              Empowering Indonesian educators to unlock AI in education through the LEAPS framework.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">LEAPS Framework</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/metrics/learn" className="text-gray-400 hover:text-white transition-colors">Learn (20 pts)</Link></li>
              <li><Link href="/metrics/explore" className="text-gray-400 hover:text-white transition-colors">Explore (50 pts)</Link></li>
              <li><Link href="/metrics/amplify" className="text-gray-400 hover:text-white transition-colors">Amplify (2/peer, 1/student)</Link></li>
              <li><Link href="/metrics/present" className="text-gray-400 hover:text-white transition-colors">Present (20 pts)</Link></li>
              <li><Link href="/metrics/shine" className="text-gray-400 hover:text-white transition-colors">Shine (Recognition)</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Community</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/leaderboard" className="text-gray-400 hover:text-white transition-colors">Leaderboard</Link></li>
              <li><Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Join Program</Link></li>
              <li><a href="https://microsoft.com/education" className="text-gray-400 hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">Microsoft Education</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">AI Learning Hub</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Educator Toolkit</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Support Center</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Community Forum</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            © 2025 Microsoft Corporation. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Privacy</a>
            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Terms</a>
            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  )
}