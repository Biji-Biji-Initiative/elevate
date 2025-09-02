import { MetadataRoute } from 'next'
import { prisma } from '@elevate/db/client'
import { getProfileUrl, getMetricsUrl } from '@elevate/types'

/**
 * Next.js 15 sitemap generation
 * Generates canonical URLs for all public content
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://leaps.mereka.org'
  
  try {
    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
      {
        url: `${baseUrl}/`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
      },
      {
        url: `${baseUrl}/leaderboard`,
        lastModified: new Date(),
        changeFrequency: 'hourly',
        priority: 0.9,
      },
      {
        url: getMetricsUrl('learn'),
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      },
      {
        url: getMetricsUrl('explore'),
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      },
      {
        url: getMetricsUrl('amplify'),
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      },
      {
        url: getMetricsUrl('present'),
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      },
      {
        url: getMetricsUrl('shine'),
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      },
    ]

    // Get all users with public profiles
    const publicProfiles = await prisma.user.findMany({
      where: {
        // Only include users with at least one public submission
        submissions: {
          some: {
            visibility: 'PUBLIC',
            status: 'APPROVED'
          }
        }
      },
      select: {
        handle: true,
        updated_at: true,
        submissions: {
          where: {
            visibility: 'PUBLIC',
            status: 'APPROVED'
          },
          select: {
            updated_at: true
          },
          orderBy: {
            updated_at: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        handle: 'asc'
      }
    })

    // Build profile pages
    const profilePages: MetadataRoute.Sitemap = publicProfiles.map(user => {
      const lastSubmissionUpdate = user.submissions[0]?.updated_at || user.updated_at
      return {
        url: getProfileUrl(user.handle),
        lastModified: new Date(lastSubmissionUpdate),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }
    })

    return [...staticPages, ...profilePages]

  } catch (error) {
    console.error('Sitemap generation error:', error)
    
    // Return minimal sitemap on error
    return [
      {
        url: `${baseUrl}/`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
      },
      {
        url: `${baseUrl}/leaderboard`,
        lastModified: new Date(),
        changeFrequency: 'hourly',
        priority: 0.9,
      },
    ]
  }
}