// Stage 4: evidence. Official sources, fact-check archive, web search and image history in
// parallel, each with its own timeout. A slow or failing source never blocks the others.
import type { Evidence } from './types'
import type { Deps } from './ports'
import { hamming, PHASH_MATCH_DISTANCE } from './phash'

export class TimeoutError extends Error {}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms} ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** Reverse image search links a journalist can open. Needs a URL the services can fetch. */
export function reverseSearchLinks(imageUrl: string): { name: string; url: string }[] {
  const u = encodeURIComponent(imageUrl)
  return [
    { name: 'Google Lens', url: `https://lens.google.com/uploadbyurl?url=${u}` },
    { name: 'TinEye', url: `https://tineye.com/search?url=${u}` },
    { name: 'Yandex', url: `https://yandex.com/images/search?rpt=imageview&url=${u}` },
  ]
}

/** Number items e1, e2… after removing duplicate URLs. Order: official, factcheck, image, web. */
export function numberEvidence(groups: Omit<Evidence, 'id'>[][], max = 10): Evidence[] {
  const seen = new Set<string>()
  const out: Evidence[] = []
  for (const group of groups) {
    for (const item of group) {
      const key = item.url || `${item.kind}:${item.title}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ ...item, id: `e${out.length + 1}` })
      if (out.length >= max) return out
    }
  }
  return out
}

export interface EvidenceQuery {
  claimEn: string
  embedding: number[]
  phash: string | null
  claimId: string
}

export async function gatherEvidence(q: EvidenceQuery, deps: Pick<Deps, 'store' | 'factcheck' | 'web' | 'log' | 'config'>): Promise<Evidence[]> {
  const ms = deps.config.evidenceTimeoutMs
  const run = async (label: string, fn: () => Promise<Omit<Evidence, 'id'>[]>) => {
    const started = Date.now()
    try {
      const items = await withTimeout(fn(), ms, label)
      deps.log.info({ stage: 'evidence', source: label, claim_id: q.claimId, count: items.length, duration_ms: Date.now() - started })
      return items
    } catch (err) {
      deps.log.error({ stage: 'evidence', source: label, claim_id: q.claimId, message: (err as Error).message, duration_ms: Date.now() - started })
      return []
    }
  }

  const imageMatches = async (): Promise<Omit<Evidence, 'id'>[]> => {
    if (!q.phash) return []
    const previous = await deps.store.claimsWithPhash(500)
    return previous
      .filter((c) => c.id !== q.claimId && c.image_phash && hamming(c.image_phash, q.phash as string) <= PHASH_MATCH_DISTANCE)
      .slice(0, 3)
      .map((c) => ({
        kind: 'image' as const,
        title: 'Same image seen in an earlier report',
        url: `/newsroom/claims/${c.id}`,
        snippet: c.text_en ?? '',
        published_at: c.received_at,
      }))
  }

  const [official, factcheck, image, web] = await Promise.all([
    run('official', () => deps.store.matchSourceItems(q.embedding, 4)),
    run('factcheck', () => deps.factcheck.search(q.claimEn)),
    run('image', imageMatches),
    run('web', () => deps.web.search(q.claimEn)),
  ])
  return numberEvidence([official, factcheck, image, web.slice(0, 4)])
}
