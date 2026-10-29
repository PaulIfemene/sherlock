// Brave Search API. Attribution ("Web results by Brave Search") is shown on the site.
import { z } from 'zod'
import type { EvidenceSearch } from '../ports'
import { fetchJson, stripHtml } from './http'
import { demoEvidenceFor } from './demoEvidence'

const Response = z.object({
  web: z
    .object({
      results: z
        .array(
          z.object({
            title: z.string(),
            url: z.string(),
            description: z.string().optional(),
            page_age: z.string().optional(),
            meta_url: z.object({ hostname: z.string().optional() }).optional(),
          }),
        )
        .default([]),
    })
    .optional(),
})

export function braveSearch(apiKey: string): EvidenceSearch {
  return {
    live: true,
    async search(query) {
      const url = new URL('https://api.search.brave.com/res/v1/web/search')
      url.searchParams.set('q', query.slice(0, 380))
      url.searchParams.set('count', '5')
      url.searchParams.set('safesearch', 'moderate')
      const json = await fetchJson(url.toString(), {
        headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
        timeoutMs: 6000,
        retries: 1,
      })
      return (Response.parse(json).web?.results ?? []).map((r) => ({
        kind: 'web' as const,
        title: stripHtml(r.title),
        url: r.url,
        snippet: stripHtml(r.description ?? ''),
        published_at: r.page_age ?? null,
        source: r.meta_url?.hostname,
      }))
    },
  }
}

export const cannedWebSearch: EvidenceSearch = {
  live: false,
  async search(query) {
    return demoEvidenceFor(query).filter((e) => e.kind === 'web')
  },
}
