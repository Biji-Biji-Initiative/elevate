import * as React from 'react'
import Link from 'next/link'

export interface FooterProps {
  // Branding
  title?: string
  description?: string
  // Links sections
  sections?: Array<{
    title: string
    links: Array<{
      label: string
      href: string
      external?: boolean
    }>
  }>
  // Bottom links
  bottomLinks?: Array<{
    label: string
    href: string
  }>
  // Copyright
  copyrightText?: string
  year?: number
}

export function Footer({
  title = "MS Elevate",
  description = "Empowering Indonesian educators to unlock AI in education through the LEAPS framework.",
  sections,
  bottomLinks,
  copyrightText = "Microsoft Corporation. All rights reserved.",
  year
}: FooterProps) {
  const currentYear = year || new Date().getFullYear()
  
  const defaultSections = [
    {
      title: 'LEAPS Framework',
      links: [
        { label: 'Learn (20 pts)', href: '/metrics/learn' },
        { label: 'Explore (50 pts)', href: '/metrics/explore' },
        { label: 'Amplify (2/peer, 1/student)', href: '/metrics/amplify' },
        { label: 'Present (20 pts)', href: '/metrics/present' },
        { label: 'Shine (Recognition)', href: '/metrics/shine' },
      ]
    },
    {
      title: 'Community',
      links: [
        { label: 'Leaderboard', href: '/leaderboard' },
        { label: 'Join Program', href: '/dashboard' },
        { label: 'Microsoft Education', href: 'https://microsoft.com/education', external: true },
      ]
    },
    {
      title: 'Resources',
      links: [
        { label: 'AI Learning Hub', href: '#' },
        { label: 'Educator Toolkit', href: '#' },
        { label: 'Support Center', href: '#' },
        { label: 'Community Forum', href: '#' },
      ]
    }
  ]

  const defaultBottomLinks = [
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'Contact', href: '#' },
  ]

  const footerSections = sections || defaultSections
  const footerBottomLinks = bottomLinks || defaultBottomLinks

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="text-xl font-bold">{title}</div>
            <p className="text-gray-400 text-sm">
              {description}
            </p>
          </div>
          
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold mb-4">{section.title}</h3>
              <ul className="space-y-2 text-sm">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a 
                        href={link.href} 
                        className="text-gray-400 hover:text-white transition-colors"
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link 
                        href={link.href} 
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            © {currentYear} {copyrightText}
          </p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            {footerBottomLinks.map((link) => (
              <a 
                key={link.label}
                href={link.href} 
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}