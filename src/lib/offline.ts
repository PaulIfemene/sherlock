// Offline demo dataset, built from the same fictional seed as `npm run demo:reset`. Used when
// Supabase is not configured, so the dashboard still works and says so.
import { DEMO_CLUSTERS, DEMO_SOURCE, SOURCE_REGISTRY } from './demoSeed'
import type { Alert, Claim, Cluster, CountPoint, EventRow, Journalist, Source, Verdict } from './types'

export const OFFLINE_JOURNALIST: Journalist = { id: 'offline', display_name: 'Demo Reporter', newsroom: 'Sample Newsroom', email: 'demo.reporter@example.org', receives_alerts: true }

const BUCKET_MS = 5 * 60 * 1000

function hex(n: number): string {
  let s = ''
  // 32-bit xorshift seeded per call: deterministic, distinct ids without floating-point overflow.
  let x = (Math.imul(n + 1, 2654435761) ^ 0x9e3779b9) >>> 0 || 1
  for (let i = 0; i < 64; i++) {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    x >>>= 0
    s += (x & 15).toString(16)
  }
  return s
}

function uuid(prefix: number, i: number): string {
  const h = hex(prefix * 100 + i)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export interface OfflineData {
  clusters: Cluster[]
  claims: Claim[]
  counts: CountPoint[]
  verdicts: Verdict[]
  alerts: Alert[]
  sources: Source[]
  events: EventRow[]
}

export function buildOfflineData(now = Date.now()): OfflineData {
  const ago = (m: number) => new Date(now - m * 60_000).toISOString()
  const end = Math.floor(now / BUCKET_MS) * BUCKET_MS
  const data: OfflineData = { clusters: [], claims: [], counts: [], verdicts: [], alerts: [], sources: [], events: [] }

  DEMO_CLUSTERS.forEach((seed, ci) => {
    const id = uuid(1, ci)
    data.clusters.push({
      id,
      canonical_text_en: seed.text_en,
      report_count: seed.buckets.reduce((a, b) => a + b, 0),
      simulated_reports: 0,
      first_seen: ago(seed.first_seen_minutes_ago),
      last_seen: ago(Math.min(...seed.claims.map((c) => c.minutes_ago))),
      status: seed.verdict ? 'published' : 'open',
      is_demo: true,
    })
    seed.buckets.forEach((count, i) => {
      if (count > 0) data.counts.push({ cluster_id: id, bucket: new Date(end - (seed.buckets.length - 1 - i) * BUCKET_MS).toISOString(), count })
    })
    seed.claims.forEach((c, j) => {
      const claimId = uuid(2, ci * 10 + j)
      data.claims.push({
        id: claimId,
        cluster_id: id,
        sender_hash: hex(900 + ci * 10 + j),
        channel: c.channel,
        original_text: c.original_text,
        original_language: c.original_language,
        text_en: c.text_en,
        image_path: null,
        ocr_text: null,
        ai_label: c.ai_label,
        ai_confidence: c.ai_confidence,
        ai_rationale: c.ai_rationale,
        evidence: seed.evidence,
        status: c.status,
        progress: 'done',
        received_at: ago(c.minutes_ago),
        is_demo: true,
      })
      data.events.push({ id: uuid(3, ci * 10 + j), cluster_id: id, claim_id: claimId, kind: c.status === 'queued' ? 'queued' : 'assessed', detail: `AI suggestion: ${c.ai_label} (${Math.round(c.ai_confidence * 100)}%). Demo seed.`, actor: null, created_at: ago(c.minutes_ago) })
    })
    if (seed.verdict) {
      data.verdicts.push({ id: uuid(4, ci), cluster_id: id, label: seed.verdict.label, explanation_en: seed.verdict.explanation_en, explanation_lug: null, explanation_swa: null, source_url: seed.verdict.source_url, journalist_id: null, published_at: ago(seed.verdict.published_minutes_ago) })
      data.events.push({ id: uuid(5, ci), cluster_id: id, claim_id: null, kind: 'published', detail: `Verdict published: ${seed.verdict.label}. Demo seed.`, actor: 'Demo Reporter', created_at: ago(seed.verdict.published_minutes_ago) })
    }
  })

  const idData = data.clusters.find((c) => c.canonical_text_en.includes('national ID'))
  if (idData) data.alerts.push({ id: uuid(6, 0), cluster_id: idData.id, sent_to: ['demo.reporter@example.org'], sent_at: ago(12), delivery: 'simulated', error: null, is_demo: true })

  data.sources = [...SOURCE_REGISTRY, DEMO_SOURCE].map((s, i) => ({
    id: uuid(7, i),
    name: s.name,
    url: s.url,
    kind: s.kind,
    selector: s.selector,
    interval_minutes: 60,
    trusted_because: s.trusted_because,
    enabled: false,
    last_success_at: s === DEMO_SOURCE ? ago(40) : null,
    last_error: null,
    last_checked_at: s === DEMO_SOURCE ? ago(40) : null,
  }))
  return data
}
