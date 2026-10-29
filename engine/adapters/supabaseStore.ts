// Store backed by Supabase with the service-role key. Server-side only.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ClaimRow, ClusterRow, Evidence, SenderRow, VerdictRow } from '../types'
import type { Store } from '../ports'

/** Similarity floor for official-source matches. Tuned for the local hashing embedder. */
const SOURCE_MATCH_THRESHOLD = 0.32

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

export function serviceClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function supabaseStore(db: SupabaseClient): Store {
  return {
    async getSender(hash) {
      return must(await db.from('senders').select('*').eq('sender_hash', hash).maybeSingle(), 'getSender') as SenderRow | null
    },
    async upsertSender(sender) {
      must(await db.from('senders').upsert(sender, { onConflict: 'sender_hash' }), 'upsertSender')
    },
    async saveReplyAddress(hash, channel, enc) {
      must(await db.from('reply_addresses').upsert({ sender_hash: hash, channel, ...enc }, { onConflict: 'sender_hash' }), 'saveReplyAddress')
    },
    async getReplyAddress(hash) {
      return must(
        await db.from('reply_addresses').select('channel,address_ciphertext,iv,tag').eq('sender_hash', hash).maybeSingle(),
        'getReplyAddress',
      ) as Awaited<ReturnType<Store['getReplyAddress']>>
    },
    async eraseSender(hash) {
      must(await db.from('claims').delete().eq('sender_hash', hash), 'eraseSender claims')
      must(await db.from('senders').delete().eq('sender_hash', hash), 'eraseSender')
    },
    async exportSender(hash) {
      const sender = must(await db.from('senders').select('*').eq('sender_hash', hash).maybeSingle(), 'exportSender') as SenderRow | null
      const claims = must(
        await db.from('claims').select('id,received_at,text_en,status').eq('sender_hash', hash).order('received_at', { ascending: false }).limit(50),
        'exportSender claims',
      ) as Pick<ClaimRow, 'id' | 'received_at' | 'text_en' | 'status'>[]
      return { sender, claims }
    },

    async createClaim(claim) {
      return must(await db.from('claims').insert(claim).select('*').single(), 'createClaim') as ClaimRow
    },
    async updateClaim(id, patch) {
      must(await db.from('claims').update(patch).eq('id', id), 'updateClaim')
    },
    async getClaim(id) {
      return must(await db.from('claims').select('*').eq('id', id).maybeSingle(), 'getClaim') as ClaimRow | null
    },
    async matchCluster(embedding, threshold) {
      const rows = must(
        await db.rpc('match_clusters', { query_embedding: JSON.stringify(embedding), match_threshold: threshold, match_count: 1 }),
        'matchCluster',
      ) as { id: string; canonical_text_en: string; status: 'open' | 'published'; report_count: number; similarity: number }[]
      const top = rows[0]
      return top ? { cluster: { id: top.id, canonical_text_en: top.canonical_text_en, status: top.status, report_count: top.report_count }, similarity: top.similarity } : null
    },
    async createCluster(textEn, embedding, isDemo) {
      return must(
        await db.from('clusters').insert({ canonical_text_en: textEn, embedding: JSON.stringify(embedding), is_demo: isDemo }).select('id,canonical_text_en,report_count,simulated_reports,first_seen,last_seen,status,is_demo').single(),
        'createCluster',
      ) as ClusterRow
    },
    async bumpCluster(clusterId, by, at, simulated = false) {
      const rows = must(
        await db.rpc('bump_cluster', { p_cluster: clusterId, p_by: by, p_at: at.toISOString(), p_simulated: simulated }),
        'bumpCluster',
      ) as { before_count: number; after_count: number }[]
      return { before: rows[0]?.before_count ?? 0, after: rows[0]?.after_count ?? by }
    },
    async clusterVelocity(clusterId, now) {
      const rows = must(await db.rpc('cluster_velocity', { p_cluster: clusterId, p_now: now.toISOString() }), 'clusterVelocity') as { last_hour: number; prev_hour: number }[]
      return { lastHour: rows[0]?.last_hour ?? 0, prevHour: rows[0]?.prev_hour ?? 0 }
    },
    async getVerdict(clusterId) {
      return must(await db.from('verdicts').select('*').eq('cluster_id', clusterId).maybeSingle(), 'getVerdict') as VerdictRow | null
    },
    async recentAssessment(clusterId, since) {
      const row = must(
        await db
          .from('claims')
          .select('ai_label,ai_confidence,ai_rationale,evidence,ai_reply_en')
          .eq('cluster_id', clusterId)
          .not('ai_reply_en', 'is', null)
          .neq('ai_label', 'under_investigation')
          .gte('received_at', since.toISOString())
          .order('received_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        'recentAssessment',
      )
      return row as Awaited<ReturnType<Store['recentAssessment']>>
    },

    async matchSourceItems(embedding, limit) {
      const rows = must(
        await db.rpc('match_source_items', { query_embedding: JSON.stringify(embedding), match_threshold: SOURCE_MATCH_THRESHOLD, match_count: limit }),
        'matchSourceItems',
      ) as { title: string | null; url: string; content_text: string | null; published_at: string | null; source_name: string }[]
      return rows.map(
        (r): Omit<Evidence, 'id'> => ({
          kind: 'official',
          title: `${r.source_name}: ${r.title ?? 'Untitled'}`,
          url: r.url,
          snippet: (r.content_text ?? '').slice(0, 300),
          published_at: r.published_at,
          source: r.source_name,
        }),
      )
    },
    async claimsWithPhash(limit) {
      return must(
        await db.from('claims').select('id,image_phash,text_en,received_at,cluster_id').not('image_phash', 'is', null).order('received_at', { ascending: false }).limit(limit),
        'claimsWithPhash',
      ) as Pick<ClaimRow, 'id' | 'image_phash' | 'text_en' | 'received_at' | 'cluster_id'>[]
    },
    async addEvent(event) {
      must(await db.from('events').insert(event), 'addEvent')
    },

    async getCluster(id) {
      return must(await db.from('clusters').select('id,canonical_text_en,report_count,simulated_reports,first_seen,last_seen,status,is_demo').eq('id', id).maybeSingle(), 'getCluster') as ClusterRow | null
    },
    async saveVerdict(verdict) {
      return must(await db.from('verdicts').upsert(verdict, { onConflict: 'cluster_id' }).select('*').single(), 'saveVerdict') as VerdictRow
    },
    async setClusterStatus(id, status) {
      must(await db.from('clusters').update({ status }).eq('id', id), 'setClusterStatus')
    },
    async claimsInCluster(clusterId) {
      return must(
        await db.from('claims').select('id,sender_hash,channel,is_demo,original_language,received_at').eq('cluster_id', clusterId).order('received_at', { ascending: true }),
        'claimsInCluster',
      ) as Awaited<ReturnType<Store['claimsInCluster']>>
    },
    async setClusterClaimsStatus(clusterId, status) {
      must(await db.from('claims').update({ status }).eq('cluster_id', clusterId), 'setClusterClaimsStatus')
    },
    async enqueueOutbound(claimIds) {
      if (claimIds.length === 0) return []
      return must(await db.from('outbound_queue').insert(claimIds.map((claim_id) => ({ claim_id }))).select('id,claim_id'), 'enqueueOutbound') as { id: string; claim_id: string }[]
    },
    async markOutbound(id, status, lastError) {
      must(await db.from('outbound_queue').update({ status, last_error: lastError, attempts: 1, updated_at: new Date().toISOString() }).eq('id', id), 'markOutbound')
    },

    async alertRecipients() {
      const [journalists, extra] = await Promise.all([
        db.from('journalists').select('email').eq('receives_alerts', true),
        db.from('settings').select('value').eq('key', 'alert_emails').maybeSingle(),
      ])
      const fromJournalists = (must(journalists, 'alertRecipients') as { email: string }[]).map((j) => j.email)
      const value = (must(extra, 'alertRecipients settings') as { value: unknown } | null)?.value
      const fromSettings = Array.isArray(value) ? value.filter((e): e is string => typeof e === 'string') : []
      return [...new Set([...fromJournalists, ...fromSettings])]
    },
    async logAlert(alert) {
      must(await db.from('alerts').insert(alert), 'logAlert')
    },
  }
}
