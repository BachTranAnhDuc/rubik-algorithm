import type { MetadataRoute } from 'next'

import { getAllCases } from '@/features/catalog/catalog-fetchers'
import { publicEnv } from '@/lib/env.client'

const BASE_URL = publicEnv.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const cases = await getAllCases()
  const now = new Date()

  const seen = new Set<string>()
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]

  for (const c of cases) {
    const puzzleUrl = `${BASE_URL}/${c.puzzleSlug}`
    if (!seen.has(puzzleUrl)) {
      seen.add(puzzleUrl)
      entries.push({
        url: puzzleUrl,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }
    const methodUrl = `${BASE_URL}/${c.puzzleSlug}/${c.methodSlug}`
    if (!seen.has(methodUrl)) {
      seen.add(methodUrl)
      entries.push({
        url: methodUrl,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }
    const setUrl = `${BASE_URL}/${c.puzzleSlug}/${c.methodSlug}/${c.setSlug}`
    if (!seen.has(setUrl)) {
      seen.add(setUrl)
      entries.push({
        url: setUrl,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    }
    entries.push({
      url: `${BASE_URL}/${c.puzzleSlug}/${c.methodSlug}/${c.setSlug}/${c.case.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }

  return entries
}

export default sitemap
