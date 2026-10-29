// Google Fact Check Tools: claims:search over published fact-checks.
import { z } from 'zod'
import type { Evidence } from '../types'
import type { EvidenceSearch } from '../ports'
import { fetchJson } from './http'
import { demoEvidenceFor } from './demoEvidence'

const Response = z.object({
  claims: z
    .array(
      z.object({
        text: z.string().optional(),
        claimant: z.string().optional(),
        claimReview: z
          .array(
            z.object({
              publisher: z.object({ name: z.string().optional(), site: z.string().optional() }).optional(),
              url: z.string(),
              title: z.string().optional(),
              reviewDate: z.string().optional(),
              textualRating: z.string().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
})

export function googleFactCheck(apiKey: string): EvidenceSearch {
  return {
    live: true,
    async search(query) {
      const url = new URL('https://factchecktools.googleapis.com/v1alpha1/claims:search')
      url.searchParams.set('query', query.slice(0, 300))
      url.searchParams.set('languageCode', 'en')
      url.searchParams.set('pageSize', '5')
      url.searchParams.set('key', apiKey)
      const json = await fetchJson(url.toString(), { timeoutMs: 6000, retries: 1 })
      const out: Omit<Evidence, 'id'>[] = []
      for (const claim of Response.parse(json).claims) {
        for (const review of claim.claimReview.slice(0, 1)) {
          const publisher = review.publisher?.name ?? review.publisher?.site ?? 'Fact-checker'
          out.push({
            kind: 'factcheck',
            title: `${publisher}: rated "${review.textualRating ?? 'see review'}"`,
            url: review.url,
            snippet: claim.text ?? review.title ?? '',
            published_at: review.reviewDate ?? null,
            source: publisher,
          })
        }
      }
      return out.slice(0, 4)
    },
  }
}

export const cannedFactCheck: EvidenceSearch = {
  live: false,
  async search(query) {
    return demoEvidenceFor(query).filter((e) => e.kind === 'factcheck')
  },
}
