// Web checker entry. POST records the claim and starts the same engine as WhatsApp.
// GET ?id=&token= returns progress and the result to the browser that asked.
import { z } from 'zod'
import { buildDeps } from '../../engine/adapters'
import { hashSender, redact, signToken, verifyToken } from '../../engine/privacy'
import { runPipeline } from '../../engine/pipeline'
import { ticketFor } from '../../engine/reply'
import { error, json, siteOrigin, triggerBackground } from '../lib/http'
import { sendRisingAlert } from '../lib/alerts'
import { applySettings } from '../lib/settings'

const MAX_IMAGE_BYTES = 4 * 1024 * 1024

const Body = z
  .object({
    text: z.string().max(4000).optional().default(''),
    image_base64: z.string().optional(),
    image_type: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
    language: z.enum(['auto', 'eng', 'lug', 'swa']).default('auto'),
    client_id: z.string().min(8).max(64),
  })
  .refine((b) => b.text.trim().length >= 8 || b.image_base64, { message: 'Send at least a sentence of text, or an image.' })

export default async (req: Request): Promise<Response> => {
  const deps = await applySettings(buildDeps())
  const secret = deps.config.phoneHashSecret || 'sherlock-dev-only'

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const id = url.searchParams.get('id') ?? ''
    const token = url.searchParams.get('token') ?? ''
    if (!z.string().uuid().safeParse(id).success || !verifyToken(secret, id, token)) return error(403, 'Unknown check')
    const claim = await deps.store.getClaim(id)
    if (!claim) return error(404, 'Not found')
    const verdict = claim.cluster_id ? await deps.store.getVerdict(claim.cluster_id) : null
    return json({
      id: claim.id,
      ticket: ticketFor(claim.id),
      progress: claim.progress,
      status: claim.status,
      text_en: claim.text_en,
      original_language: claim.original_language,
      label: claim.ai_label,
      confidence: claim.ai_confidence,
      reply: claim.reply_text,
      evidence: claim.evidence,
      verdict: verdict && { label: verdict.label, explanation_en: verdict.explanation_en, source_url: verdict.source_url, published_at: verdict.published_at },
    })
  }

  if (req.method !== 'POST') return error(405, 'Method not allowed')
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, parsed.error.issues[0]?.message ?? 'Invalid request')
  const body = parsed.data
  const image = body.image_base64 ? Buffer.from(body.image_base64, 'base64') : null
  if (image && image.length > MAX_IMAGE_BYTES) return error(413, 'Image is larger than 4 MB')

  // Web senders are identified only by a random browser ID, hashed like a phone number.
  const senderHash = hashSender(secret, `web:${body.client_id}`)
  await deps.store.upsertSender({ sender_hash: senderHash, last_message_at: new Date().toISOString() })
  const hint = body.language === 'auto' ? null : body.language
  const claim = await deps.store.createClaim({
    channel: 'web',
    sender_hash: senderHash,
    original_text: body.text.trim() ? redact(body.text) : null,
    original_language: hint,
    is_demo: false,
  })
  const token = signToken(secret, claim.id)
  const origin = siteOrigin(req)

  if (deps.db) {
    if (image) {
      const path = `${claim.id}.${body.image_type === 'image/png' ? 'png' : body.image_type === 'image/webp' ? 'webp' : 'jpg'}`
      const up = await deps.db.storage.from('claim-media').upload(path, image, { contentType: body.image_type ?? 'image/jpeg', upsert: true })
      if (!up.error) await deps.store.updateClaim(claim.id, { image_path: path })
    }
    try {
      await triggerBackground(origin, { source: 'web', claim_id: claim.id })
    } catch (err) {
      deps.log.error({ stage: 'intake', claim_id: claim.id, message: (err as Error).message })
      return error(502, 'Could not start the check. Please try again.')
    }
    return json({ id: claim.id, token, ticket: ticketFor(claim.id) }, 202)
  }

  // No database: run inline against the in-memory store so the demo still answers.
  await runPipeline(
    { claimId: claim.id, text: body.text || null, image: image ? new Uint8Array(image) : null, languageHint: hint, replyLanguage: hint, isDemo: false },
    { ...deps, onRising: (clusterId, count) => sendRisingAlert(deps, clusterId, count, origin) },
  )
  return json({ id: claim.id, token, ticket: ticketFor(claim.id) }, 202)
}
