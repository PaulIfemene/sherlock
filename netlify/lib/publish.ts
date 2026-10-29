// Stage 8: publish a verdict and send it back to everyone who asked.
import type { ServerDeps } from '../../engine/adapters'
import type { AiLabel, Lang } from '../../engine/types'
import { decryptAddress } from '../../engine/privacy'
import { verdictMessage } from '../../engine/feedback'
import { ticketFor } from '../../engine/reply'
import type { Journalist } from './http'

export interface PublishInput {
  cluster_id: string
  label: AiLabel
  explanation_en: string
  explanation_lug?: string | null
  explanation_swa?: string | null
  source_url?: string | null
}

export interface DeliveryCounts {
  sent: number
  simulated: number
  needs_template: number
  failed: number
  web: number
}

async function translateOrNull(deps: ServerDeps, text: string, to: Lang): Promise<string | null> {
  try {
    return await deps.translator.translate(text, 'eng', to)
  } catch {
    return null
  }
}

export async function publishVerdict(input: PublishInput, journalist: Journalist, deps: ServerDeps): Promise<{ verdict_id: string; delivery: DeliveryCounts }> {
  const db = deps.db
  if (!db) throw new Error('Supabase is not configured')
  const [lug, swa] = await Promise.all([
    input.explanation_lug?.trim() ? Promise.resolve(input.explanation_lug.trim()) : translateOrNull(deps, input.explanation_en, 'lug'),
    input.explanation_swa?.trim() ? Promise.resolve(input.explanation_swa.trim()) : translateOrNull(deps, input.explanation_en, 'swa'),
  ])
  const verdictRow = {
    cluster_id: input.cluster_id,
    label: input.label,
    explanation_en: input.explanation_en.trim(),
    explanation_lug: lug,
    explanation_swa: swa,
    source_url: input.source_url?.trim() || null,
    journalist_id: journalist.id,
    published_at: new Date().toISOString(),
  }
  const { data: verdict, error } = await db.from('verdicts').upsert(verdictRow, { onConflict: 'cluster_id' }).select('*').single()
  if (error || !verdict) throw new Error(`save verdict: ${error?.message}`)

  await db.from('clusters').update({ status: 'published' }).eq('id', input.cluster_id)
  await deps.store.addEvent({ cluster_id: input.cluster_id, kind: 'published', detail: `Verdict published: ${input.label}.`, actor: journalist.display_name })

  // Queue every claim in the cluster, then deliver.
  const { data: claims } = await db.from('claims').select('id,sender_hash,channel,is_demo').eq('cluster_id', input.cluster_id)
  const delivery: DeliveryCounts = { sent: 0, simulated: 0, needs_template: 0, failed: 0, web: 0 }
  const list = claims ?? []
  if (list.length === 0) return { verdict_id: verdict.id as string, delivery }
  const { data: queued } = await db
    .from('outbound_queue')
    .insert(list.map((c) => ({ claim_id: c.id })))
    .select('id,claim_id')
  const queueByClaim = new Map((queued ?? []).map((q) => [q.claim_id as string, q.id as string]))
  await db.from('claims').update({ status: 'published' }).eq('cluster_id', input.cluster_id)

  const now = Date.now()
  const deliverOne = async (claim: { id: string; sender_hash: string | null; channel: string; is_demo: boolean }) => {
    const queueId = queueByClaim.get(claim.id)
    const mark = (status: 'sent' | 'needs_template' | 'failed', last_error: string | null = null) =>
      queueId ? db.from('outbound_queue').update({ status, last_error, attempts: 1, updated_at: new Date().toISOString() }).eq('id', queueId) : Promise.resolve()

    if (claim.is_demo) {
      // Seeded demo reports have no real sender behind them.
      delivery.simulated++
      await mark('sent', 'simulated: demo report')
      return
    }
    if (claim.channel === 'web' || !claim.sender_hash) {
      // Web users read the verdict on their check page; nothing to send.
      delivery.web++
      await mark('sent', 'web: shown on the check page')
      return
    }
    const sender = await deps.store.getSender(claim.sender_hash)
    if (!sender || sender.opted_out) {
      delivery.failed++
      await mark('failed', sender ? 'sender opted out' : 'sender erased their data')
      return
    }
    // Only providers with a reply window (Meta) need a template after it closes. Green API has none.
    const windowMs = deps.whatsapp.replyWindowMs
    if (windowMs !== null && (!sender.last_message_at || now - new Date(sender.last_message_at).getTime() > windowMs)) {
      delivery.needs_template++
      await mark('needs_template', 'outside the reply window; needs an approved template')
      return
    }
    const address = await deps.store.getReplyAddress(claim.sender_hash)
    if (!address) {
      delivery.failed++
      await mark('failed', 'no reply address')
      return
    }
    try {
      const lang: Lang = sender.language_pref ?? 'eng'
      const text = await verdictMessage(verdict, lang, ticketFor(claim.id), deps.translator, deps.log)
      // Decrypted only here, used once, never logged.
      await deps.whatsapp.sendText(decryptAddress(deps.config.replyAddressKey, address), text)
      if (deps.whatsapp.live) delivery.sent++
      else delivery.simulated++
      await mark('sent', deps.whatsapp.live ? null : 'simulated: WhatsApp not configured')
    } catch (err) {
      delivery.failed++
      await mark('failed', (err as Error).message.slice(0, 300))
    }
  }

  // Small pool keeps us inside the function time limit without hammering the Graph API.
  const pool = 5
  for (let i = 0; i < list.length; i += pool) await Promise.all(list.slice(i, i + pool).map(deliverOne))

  await deps.store.addEvent({
    cluster_id: input.cluster_id,
    kind: 'delivered',
    detail: `Verdict delivery: ${delivery.sent} sent, ${delivery.simulated} simulated, ${delivery.needs_template} need a template, ${delivery.failed} failed, ${delivery.web} web.`,
  })
  return { verdict_id: verdict.id as string, delivery }
}
