// Stage 8: publish a verdict and send it back to everyone who asked. Uses only the Store, so it
// runs the same against Supabase and the in-memory demo store.
import type { ServerDeps } from '../../engine/adapters'
import type { AiLabel, Lang } from '../../engine/types'
import { decryptAddress } from '../../engine/privacy'
import { verdictMessage } from '../../engine/feedback'
import { ticketFor } from '../../engine/reply'
import type { OutboundStatus } from '../../engine/ports'

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

export interface Publisher {
  id: string | null
  display_name: string
}

async function translateOrNull(deps: ServerDeps, text: string, to: Lang): Promise<string | null> {
  try {
    return await deps.translator.translate(text, 'eng', to)
  } catch {
    return null
  }
}

export async function publishVerdict(input: PublishInput, journalist: Publisher, deps: ServerDeps): Promise<{ verdict_id: string; delivery: DeliveryCounts }> {
  const { store, log } = deps
  const cluster = await store.getCluster(input.cluster_id)
  if (!cluster) throw new Error('cluster not found')

  // Journalist-edited translations win; otherwise Sunbird translates now. Null means English only.
  const [lug, swa] = await Promise.all([
    input.explanation_lug?.trim() || translateOrNull(deps, input.explanation_en, 'lug'),
    input.explanation_swa?.trim() || translateOrNull(deps, input.explanation_en, 'swa'),
  ])
  const verdict = await store.saveVerdict({
    cluster_id: input.cluster_id,
    label: input.label,
    explanation_en: input.explanation_en.trim(),
    explanation_lug: lug,
    explanation_swa: swa,
    source_url: input.source_url?.trim() || null,
    journalist_id: journalist.id,
    published_at: new Date().toISOString(),
  })
  await store.setClusterStatus(input.cluster_id, 'published')
  await store.addEvent({ cluster_id: input.cluster_id, kind: 'published', detail: `Verdict published: ${input.label}.`, actor: journalist.display_name })

  const claims = await store.claimsInCluster(input.cluster_id)
  const delivery: DeliveryCounts = { sent: 0, simulated: 0, needs_template: 0, failed: 0, web: 0 }
  if (claims.length === 0) return { verdict_id: verdict.id, delivery }
  const queued = await store.enqueueOutbound(claims.map((c) => c.id))
  const queueByClaim = new Map(queued.map((q) => [q.claim_id, q.id]))
  await store.setClusterClaimsStatus(input.cluster_id, 'published')

  const now = deps.now().getTime()
  const deliverOne = async (claim: (typeof claims)[number]) => {
    const queueId = queueByClaim.get(claim.id)
    const mark = (status: OutboundStatus, error: string | null = null) => (queueId ? store.markOutbound(queueId, status, error) : Promise.resolve())

    if (claim.is_demo) {
      // Seeded demo reports have no real sender behind them.
      delivery.simulated++
      return mark('sent', 'simulated: demo report')
    }
    if (claim.channel === 'web' || !claim.sender_hash) {
      // Web users see the verdict on their check page; nothing to send.
      delivery.web++
      return mark('sent', 'web: shown on the check page')
    }
    const sender = await store.getSender(claim.sender_hash)
    if (!sender || sender.opted_out) {
      delivery.failed++
      return mark('failed', sender ? 'sender opted out' : 'sender erased their data')
    }
    // Only providers with a reply window (Meta) need a template after it closes. Green API has none.
    const windowMs = deps.whatsapp.replyWindowMs
    if (windowMs !== null && (!sender.last_message_at || now - new Date(sender.last_message_at).getTime() > windowMs)) {
      delivery.needs_template++
      return mark('needs_template', 'outside the reply window; needs an approved template')
    }
    const address = await store.getReplyAddress(claim.sender_hash)
    if (!address) {
      delivery.failed++
      return mark('failed', 'no reply address')
    }
    try {
      const lang: Lang = sender.language_pref ?? claim.original_language ?? 'eng'
      const text = await verdictMessage(verdict, lang, ticketFor(claim.id), deps.translator, log)
      // Decrypted only here, used once, never logged.
      await deps.whatsapp.sendText(decryptAddress(deps.config.replyAddressKey, address), text)
      if (deps.whatsapp.live) delivery.sent++
      else delivery.simulated++
      return mark('sent', deps.whatsapp.live ? null : 'simulated: WhatsApp not configured')
    } catch (err) {
      delivery.failed++
      log.error({ stage: 'publish', claim_id: claim.id, message: (err as Error).message })
      return mark('failed', (err as Error).message.slice(0, 300))
    }
  }

  // Small pool keeps us inside the function time limit without hammering the WhatsApp API.
  const pool = 5
  for (let i = 0; i < claims.length; i += pool) await Promise.all(claims.slice(i, i + pool).map(deliverOne))

  await store.addEvent({
    cluster_id: input.cluster_id,
    kind: 'delivered',
    detail: `Verdict delivery: ${delivery.sent} sent, ${delivery.simulated} simulated, ${delivery.needs_template} need a template, ${delivery.failed} failed, ${delivery.web} web.`,
  })
  return { verdict_id: verdict.id, delivery }
}
