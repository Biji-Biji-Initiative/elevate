// Analytics tracking helper for homepage events
// Safely calls gtag when Google Analytics is available
import { useEffect } from 'react'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

export interface CTAClickEvent {
  area: 'hero' | 'stories' | 'dual_paths' | 'convening'
  label: string
}

export interface LeapsSubmitEvent {
  stage: 'learn' | 'explore' | 'amplify' | 'present' | 'shine'
  points: number
}

export interface ScrollDepthEvent {
  percent: 25 | 50 | 75 | 100
}

export interface UGCEvent {
  post_id?: string
}

// Safe gtag wrapper
function trackEvent(eventName: string, parameters: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.gtag) {
    try {
      window.gtag('event', eventName, parameters)
    } catch (error) {
      // Silently fail - don't break the app if analytics fails
      console.debug('Analytics tracking failed:', error)
    }
  }
}

// Homepage-specific event tracking functions
export const analytics = {
  // Track page view
  pageView: (page: string) => {
    trackEvent('page_view', { page })
  },

  // Track CTA clicks
  ctaClick: (event: CTAClickEvent) => {
    trackEvent('cta_click', {
      area: event.area,
      label: event.label,
    })
  },

  // Track LEAPS submission success
  leapsSubmit: (event: LeapsSubmitEvent) => {
    trackEvent('leaps_submit', {
      stage: event.stage,
      points: event.points,
    })
  },

  // Track scroll depth milestones
  scrollDepth: (event: ScrollDepthEvent) => {
    trackEvent('scroll_depth', {
      percent: event.percent,
    })
  },

  // Track user-generated content interactions
  ugcView: (event?: UGCEvent) => {
    trackEvent('ugc_view', event || {})
  },

  ugcClick: (event: UGCEvent) => {
    trackEvent('ugc_click', {
      post_id: event.post_id,
    })
  },
}

// Hook for scroll depth tracking
export function useScrollDepthTracking() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const milestones = [25, 50, 75, 100]
    const tracked = new Set<number>()

    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight
      const scrollPercent = Math.round((scrollTop / docHeight) * 100)

      milestones.forEach((milestone) => {
        if (scrollPercent >= milestone && !tracked.has(milestone)) {
          tracked.add(milestone)
          analytics.scrollDepth({
            percent: milestone as 25 | 50 | 75 | 100,
          })
        }
      })
    }

    let ticking = false
    const throttledHandler = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', throttledHandler, { passive: true })
    return () => {
      window.removeEventListener('scroll', throttledHandler)
    }
  }, [])
}
