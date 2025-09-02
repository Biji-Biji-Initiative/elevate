'use client'

import { useState } from 'react'
import { Button } from '@elevate/ui'

interface ShareButtonProps {
  url: string
  title: string
  text?: string
  size?: 'sm' | 'md' | 'lg'
}

export function ShareButton({ url, title, text, size = 'md' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  
  const handleShare = async () => {
    const shareData = {
      title,
      text: text || `Check out ${title} on MS Elevate LEAPS Tracker`,
      url,
    }
    
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        // User cancelled or error occurred
        console.log('Share cancelled')
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy to clipboard')
      }
    }
  }
  
  return (
    <Button 
      variant="ghost" 
      onClick={handleShare}
      disabled={copied}
    >
      {copied ? 'Copied!' : 'Share'}
    </Button>
  )
}

export function SocialShareButtons({ 
  url, 
  title, 
  text 
}: { 
  url: string
  title: string
  text?: string 
}) {
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)
  const encodedText = encodeURIComponent(text || `Check out ${title} on MS Elevate LEAPS Tracker`)
  
  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
  }
  
  return (
    <div className="flex space-x-2">
      <a
        href={shareUrls.twitter}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        Twitter
      </a>
      <a
        href={shareUrls.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-3 py-1 text-sm bg-blue-700 text-white rounded hover:bg-blue-800 transition-colors"
      >
        LinkedIn
      </a>
      <a
        href={shareUrls.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
      >
        WhatsApp
      </a>
    </div>
  )
}