// In-memory Store for tests, and for running the engine with no database configured.
import { randomUUID } from 'node:crypto'
import type { ClaimRow, ClusterRow, EncryptedAddress, Evidence, SenderRow, VerdictRow } from './types'
import type { OutboundStatus, Store } from './ports'
import { bucketOf, cosine, velocity } from './cluster'

export interface MemoryState {
  senders: Map<string, SenderRow>
  addresses: Map<string, EncryptedAddress & { channel: 'whatsapp' | 'web' }>
  claims: Map<string, ClaimRow>
  clusters: Map<string, ClusterRow & { embedding: number[] }>
  counts: Map<string, { bucket: string; count: number }[]>
  verdicts: Map<string, VerdictRow>
  sourceItems: (Omit<Evidence, 'id'> & { embedding: number[] })[]
  events: { cluster_id?: string | null; claim_id?: string | null; kind: string; detail: string; created_at: string }[]
  outbound: { id: string; claim_id: string; status: OutboundStatus; last_error: string | null }[]
  alerts: { cluster_id: string; sent_to: string[]; delivery: string; error: string | null; is_demo: boolean }[]
  alertEmails: string[]
}

export function memoryState(): MemoryState {
  return { senders: new Map(), addresses: new Map(), claims: new Map(), clusters: new Map(), counts: new Map(), verdicts: new Map(), sourceItems: [], events: [], outbound: [], alerts: [], alertEmails: ['demo.reporter@example.org'] }
}

export function memoryStore(state: MemoryState = memoryState()): Store & { state: MemoryState } {
  return {
    state,
    async getSender(hash) {
      return state.senders.get(hash) ?? null
    },
    async upsertSender(sender) {
      const prev = state.senders.get(sender.sender_hash)
      state.senders.set(sender.sender_hash, {
        language_pref: null,
        consent_version: null,
        consent_at: null,
        opted_out: false,
        last_message_at: null,
        ...prev,
        ...sender,
      })
    },
    async saveReplyAddress(hash, channel, enc) {
      state.addresses.set(hash, { ...enc, channel })
    },
    async getReplyAddress(hash) {
      return state.addresses.get(hash) ?? null
    },
    async eraseSender(hash) {
      for (const [id, c] of state.claims) if (c.sender_hash === hash) state.claims.delete(id)
      state.addresses.delete(hash)
      state.senders.delete(hash)
    },
    async exportSender(hash) {
      const claims = [...state.claims.values()].filter((c) => c.sender_hash === hash).map(({ id, received_at, text_en, status }) => ({ id, received_at, text_en, status }))
      return { sender: state.senders.get(hash) ?? null, claims }
    },
    async createClaim(claim) {
      const row: ClaimRow = {
        id: randomUUID(),
        cluster_id: null,
        original_text: null,
        original_language: null,
        text_en: null,
        image_path: null,
        image_phash: null,
        ocr_text: null,
        ai_label: null,
        ai_confidence: null,
        ai_rationale: null,
        ai_reply_en: null,
        evidence: [],
        status: 'received',
        progress: 'received',
        reply_text: null,
        reply_language: null,
        received_at: new Date().toISOString(),
        ...claim,
      }
      state.claims.set(row.id, row)
      return row
    },
    async updateClaim(id, patch) {
      const prev = state.claims.get(id)
      if (prev) state.claims.set(id, { ...prev, ...patch })
    },
    async getClaim(id) {
      return state.claims.get(id) ?? null
    },
    async matchCluster(embedding, threshold) {
      let best: { c: ClusterRow & { embedding: number[] }; s: number } | null = null
      for (const c of state.clusters.values()) {
        const s = cosine(embedding, c.embedding)
        if (s >= threshold && (!best || s > best.s)) best = { c, s }
      }
      return best ? { cluster: best.c, similarity: best.s } : null
    },
    async createCluster(textEn, embedding, isDemo) {
      const now = new Date().toISOString()
      const row = { id: randomUUID(), canonical_text_en: textEn, embedding, report_count: 0, simulated_reports: 0, first_seen: now, last_seen: now, status: 'open' as const, is_demo: isDemo }
      state.clusters.set(row.id, row)
      return row
    },
    async bumpCluster(clusterId, by, at, simulated = false) {
      const c = state.clusters.get(clusterId)
      if (!c) throw new Error('cluster not found')
      const before = c.report_count
      c.report_count += by
      if (simulated) c.simulated_reports += by
      c.last_seen = at.toISOString()
      const bucket = bucketOf(at).toISOString()
      const list = state.counts.get(clusterId) ?? []
      const hit = list.find((p) => p.bucket === bucket)
      if (hit) hit.count += by
      else list.push({ bucket, count: by })
      state.counts.set(clusterId, list)
      return { before, after: c.report_count }
    },
    async clusterVelocity(clusterId, now) {
      const v = velocity(state.counts.get(clusterId) ?? [], now)
      return { lastHour: v.lastHour, prevHour: v.prevHour }
    },
    async getVerdict(clusterId) {
      return state.verdicts.get(clusterId) ?? null
    },
    async recentAssessment(clusterId, since) {
      const hit = [...state.claims.values()]
        .filter((c) => c.cluster_id === clusterId && c.ai_reply_en && c.ai_label !== 'under_investigation' && new Date(c.received_at) >= since)
        .sort((a, b) => b.received_at.localeCompare(a.received_at))[0]
      return hit ? { ai_label: hit.ai_label, ai_confidence: hit.ai_confidence, ai_rationale: hit.ai_rationale, evidence: hit.evidence, ai_reply_en: hit.ai_reply_en } : null
    },
    async matchSourceItems(embedding, limit) {
      return state.sourceItems
        .map((item) => ({ item, s: cosine(embedding, item.embedding) }))
        .filter((x) => x.s >= 0.32)
        .sort((a, b) => b.s - a.s)
        .slice(0, limit)
        .map(({ item: { embedding: _e, ...rest } }) => rest)
    },
    async claimsWithPhash(limit) {
      return [...state.claims.values()].filter((c) => c.image_phash).slice(0, limit)
    },
    async addEvent(event) {
      state.events.push({ ...event, created_at: new Date().toISOString() })
    },
    async getCluster(id) {
      const c = state.clusters.get(id)
      if (!c) return null
      const { embedding: _e, ...row } = c
      return row
    },
    async saveVerdict(verdict) {
      const row = { id: state.verdicts.get(verdict.cluster_id)?.id ?? randomUUID(), ...verdict }
      state.verdicts.set(verdict.cluster_id, row)
      return row
    },
    async setClusterStatus(id, status) {
      const c = state.clusters.get(id)
      if (c) c.status = status
    },
    async claimsInCluster(clusterId) {
      return [...state.claims.values()].filter((c) => c.cluster_id === clusterId).sort((a, b) => a.received_at.localeCompare(b.received_at))
    },
    async setClusterClaimsStatus(clusterId, status) {
      for (const c of state.claims.values()) if (c.cluster_id === clusterId) c.status = status
    },
    async enqueueOutbound(claimIds) {
      const rows = claimIds.map((claim_id) => ({ id: randomUUID(), claim_id, status: 'pending' as const, last_error: null }))
      state.outbound.push(...rows)
      return rows.map(({ id, claim_id }) => ({ id, claim_id }))
    },
    async markOutbound(id, status, lastError) {
      const row = state.outbound.find((o) => o.id === id)
      if (row) Object.assign(row, { status, last_error: lastError })
    },
    async alertRecipients() {
      return [...state.alertEmails]
    },
    async logAlert(alert) {
      state.alerts.push(alert)
    },
  }
}
