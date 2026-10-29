// npm run demo:reset          remove demo rows and simulated counts, then reseed.
// npm run demo:reset -- --all remove every claim, cluster, sender and alert first (full rehearsal reset).
import 'dotenv/config'
import { createHmac, randomBytes } from 'node:crypto'
import { serviceClient } from '../engine/adapters/supabaseStore'
import { embedLocal } from '../engine/embed'
import { BUCKET_MS, bucketOf } from '../engine/cluster'
import { DEMO_CLUSTERS, DEMO_SOURCE, SOURCE_REGISTRY } from '../src/lib/demoSeed'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.')
  process.exit(1)
}
const db = serviceClient(url, key)
const all = process.argv.includes('--all')
const NIL = '00000000-0000-0000-0000-000000000000'

async function check<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

// 1. Clear -------------------------------------------------------------------------------------
if (all) {
  await check(db.from('clusters').delete().neq('id', NIL), 'clear clusters')
  await check(db.from('claims').delete().neq('id', NIL), 'clear claims')
  await check(db.from('senders').delete().neq('sender_hash', ''), 'clear senders')
  await check(db.from('alerts').delete().neq('id', NIL), 'clear alerts')
  await check(db.from('events').delete().neq('id', NIL), 'clear events')
} else {
  // Cascades remove demo claims, counts, verdicts, alerts and events.
  await check(db.from('clusters').delete().eq('is_demo', true), 'clear demo clusters')
  await check(db.from('claims').delete().eq('is_demo', true), 'clear demo claims')
  await check(db.from('alerts').delete().eq('is_demo', true), 'clear demo alerts')
  await check(db.from('senders').delete().like('consent_version', 'demo%'), 'clear demo senders')
  // Real clusters keep their real reports; simulated ones are taken back out.
  const touched = await check(db.from('clusters').select('id,report_count,simulated_reports').gt('simulated_reports', 0), 'find simulated')
  for (const c of touched ?? []) {
    await check(db.from('clusters').update({ report_count: c.report_count - c.simulated_reports, simulated_reports: 0 }).eq('id', c.id), 'unsimulate')
    await check(db.from('cluster_counts').delete().eq('cluster_id', c.id), 'clear counts')
    await check(db.from('cluster_counts').insert({ cluster_id: c.id, bucket: bucketOf(new Date()).toISOString(), count: c.report_count - c.simulated_reports }), 'restore count')
  }
}

// 2. Sources -----------------------------------------------------------------------------------
const existing = new Set(((await check(db.from('sources').select('url'), 'list sources')) ?? []).map((s) => s.url as string))
const newSources = SOURCE_REGISTRY.filter((s) => !existing.has(s.url)).map((s) => ({ ...s, enabled: false, interval_minutes: 60 }))
if (newSources.length) await check(db.from('sources').insert(newSources), 'insert sources')
let demoSourceId = ((await check(db.from('sources').select('id').eq('url', DEMO_SOURCE.url).maybeSingle(), 'find demo source')) as { id: string } | null)?.id
if (!demoSourceId) {
  const { items: _items, ...source } = DEMO_SOURCE
  demoSourceId = ((await check(db.from('sources').insert({ ...source, enabled: false, last_success_at: new Date().toISOString() }).select('id').single(), 'insert demo source')) as { id: string }).id
}
await check(
  db.from('source_items').upsert(
    DEMO_SOURCE.items.map((i) => ({ ...i, source_id: demoSourceId, embedding: JSON.stringify(embedLocal(`${i.title}. ${i.content_text}`)) })),
    { onConflict: 'url' },
  ),
  'insert demo source items',
)

// 3. Demo clusters, claims, counts and verdicts ---------------------------------------------------
const now = new Date()
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()
const fakeHash = () => createHmac('sha256', randomBytes(16)).update('demo').digest('hex')

for (const seed of DEMO_CLUSTERS) {
  const total = seed.buckets.reduce((a, b) => a + b, 0)
  const cluster = (await check(
    db
      .from('clusters')
      .insert({
        canonical_text_en: seed.text_en,
        embedding: JSON.stringify(embedLocal(seed.text_en)),
        report_count: total,
        first_seen: minutesAgo(seed.first_seen_minutes_ago),
        last_seen: minutesAgo(Math.min(...seed.claims.map((c) => c.minutes_ago))),
        status: seed.verdict ? 'published' : 'open',
        is_demo: true,
      })
      .select('id')
      .single(),
    `insert cluster ${seed.key}`,
  )) as { id: string }

  const end = bucketOf(now).getTime()
  const counts = seed.buckets
    .map((count, i) => ({ cluster_id: cluster.id, bucket: new Date(end - (seed.buckets.length - 1 - i) * BUCKET_MS).toISOString(), count }))
    .filter((c) => c.count > 0)
  if (counts.length) await check(db.from('cluster_counts').insert(counts), 'insert counts')

  for (const c of seed.claims) {
    const sender_hash = fakeHash()
    await check(db.from('senders').insert({ sender_hash, language_pref: c.original_language, consent_version: 'demo-seed', consent_at: minutesAgo(c.minutes_ago), last_message_at: minutesAgo(c.minutes_ago) }), 'insert sender')
    const claim = (await check(
      db
        .from('claims')
        .insert({
          cluster_id: cluster.id,
          sender_hash,
          channel: c.channel,
          original_text: c.original_text,
          original_language: c.original_language,
          text_en: c.text_en,
          ai_label: c.ai_label,
          ai_confidence: c.ai_confidence,
          ai_rationale: c.ai_rationale,
          evidence: seed.evidence,
          status: c.status,
          progress: 'done',
          received_at: minutesAgo(c.minutes_ago),
          is_demo: true,
        })
        .select('id')
        .single(),
      'insert claim',
    )) as { id: string }
    await check(db.from('events').insert({ cluster_id: cluster.id, claim_id: claim.id, kind: c.status === 'queued' ? 'queued' : 'assessed', detail: `AI suggestion: ${c.ai_label} (${Math.round(c.ai_confidence * 100)}%). Demo seed.`, created_at: minutesAgo(c.minutes_ago) }), 'insert event')
  }

  if (seed.verdict) {
    await check(
      db.from('verdicts').insert({
        cluster_id: cluster.id,
        label: seed.verdict.label,
        explanation_en: seed.verdict.explanation_en,
        source_url: seed.verdict.source_url,
        published_at: minutesAgo(seed.verdict.published_minutes_ago),
      }),
      'insert verdict',
    )
    await check(db.from('events').insert({ cluster_id: cluster.id, kind: 'published', detail: `Verdict published: ${seed.verdict.label}. Demo seed.`, actor: 'Demo Reporter', created_at: minutesAgo(seed.verdict.published_minutes_ago) }), 'insert event')
  }
}

// 4. Demo journalist invite ------------------------------------------------------------------------
const inviteEmail = process.env.DEMO_JOURNALIST_EMAIL
if (inviteEmail) {
  await check(db.from('journalist_invites').upsert({ email: inviteEmail.toLowerCase(), display_name: 'Demo Reporter', newsroom: 'Sample Newsroom' }), 'invite')
  // If that person already signed in once, the sign-up trigger has passed; add the journalist row now.
  const { data: users } = await db.auth.admin.listUsers({ perPage: 200 })
  const user = users?.users.find((u) => u.email?.toLowerCase() === inviteEmail.toLowerCase())
  if (user) {
    await check(db.from('journalists').upsert({ id: user.id, display_name: 'Demo Reporter', newsroom: 'Sample Newsroom', email: inviteEmail.toLowerCase() }), 'journalist')
  }
}

console.log(`Seeded ${DEMO_CLUSTERS.length} demo clusters, ${SOURCE_REGISTRY.length} proposed sources (disabled)${inviteEmail ? `, invite for ${inviteEmail}` : ''}.${all ? ' Full reset.' : ''}`)
