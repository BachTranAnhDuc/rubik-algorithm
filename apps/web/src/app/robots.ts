import type { MetadataRoute } from 'next'

import { publicEnv } from '@/lib/env.client'

const BASE_URL = publicEnv.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const robots = (): MetadataRoute.Robots => ({
  rules: [
    {
      userAgent: '*',
      allow: '/',
      disallow: ['/me/', '/embed/', '/api/'],
    },
  ],
  sitemap: `${BASE_URL}/sitemap.xml`,
})

export default robots
