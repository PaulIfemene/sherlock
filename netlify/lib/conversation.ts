// WhatsApp conversation and web-check processing. Runs inside process-message-background.
import type { ServerDeps } from '../../engine/adapters'
import type { Lang } from '../../engine/types'
import { CONSENT_VERSION, LANGUAGE_SET_TEXT, parseKeyword, SYSTEM_TEXT } from '../../engine/intake'
import type { InboundMessage } from '../../engine/adapters/greenapi'
import { encryptAddress, hashSender, toE164 } from '../../engine/privacy'
import { runPipeline } from '../../engine/pipeline'
import { ticketFor } from '../../engine/reply'
import { sendRisingAlert } from './alerts'

const MEDIA_BUCKET = 'claim-media'
const HOLDING_MESSAGE_MS = 8000
const QUICK_TRANSLATE_MS = 5000

async function say(deps: ServerDeps, to: string, english: string, lang: Lang): Promise<void> {
  let text = english
  if (lang !== 'eng') {
    try {
      text = await deps.translator.translate(english, 'eng', lang)
    } catch {
      // English is better than silence.
    }
  }
  await deps.whatsapp.sendText(to, text)
}

/** Like say(), but never waits long on translation: falls back to English after a few seconds. */
async function sayQuick(deps: ServerDeps, to: string, english: string, lang: Lang): Promise<void> {
  let text = english
  if (lang !== 'eng') {
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), QUICK_TRANSLATE_MS))
    text = (await Promise.race([deps.translator.translate(english, 'eng', lang).catch(() => null), timeout])) ?? english
  }
  await deps.whatsapp.sendText(to, text)
}

function pipelineDeps(deps: ServerDeps, origin: string) {
  return { ...deps, onRising: (clusterId: string, count: number) => sendRisingAlert(deps, clusterId, count, origin) }
}

export async function handleWhatsAppMessage(msg: InboundMessage, deps: ServerDeps, origin: string): Promise<void> {
  const { store, log, config } = deps
  const e164 = toE164(msg.from)
  const hash = hashSender(config.phoneHashSecret, e164)
  const sender = await store.getSender(hash)
  const lang: Lang = sender?.language_pref ?? 'eng'
  const keyword = parseKeyword(msg.text)
  log.info({ stage: 'intake', channel: 'whatsapp', sender: hash.slice(0, 8), type: msg.type, keyword: keyword?.kind ?? null })

  if (keyword?.kind === 'stop') {
    await store.upsertSender({ sender_hash: hash, opted_out: true, last_message_at: msg.timestamp.toISOString() })
    await say(deps, e164, SYSTEM_TEXT.stopped, lang)
    return
  }
  if (sender?.opted_out && keyword?.kind !== 'start') return
  if (keyword?.kind === 'delete') {
    await store.eraseSender(hash)
    await say(deps, e164, SYSTEM_TEXT.deleted, lang)
    return
  }

  // Keep the encrypted reply address current; it is needed to send the verdict later.
  await store.upsertSender({ sender_hash: hash, last_message_at: msg.timestamp.toISOString(), ...(keyword?.kind === 'start' ? { opted_out: false } : {}) })
  await store.saveReplyAddress(hash, 'whatsapp', encryptAddress(config.replyAddressKey, e164))

  if (keyword?.kind === 'start') {
    await say(deps, e164, SYSTEM_TEXT.started, lang)
    return
  }
  if (keyword?.kind === 'mydata') {
    const data = await store.exportSender(hash)
    const lines = data.claims.slice(0, 5).map((c) => `#${ticketFor(c.id)} ${c.received_at.slice(0, 10)} ${c.status}`)
    const summary = `Your Sherlock data. ID (scrambled): ${hash.slice(0, 8)}…. Language: ${data.sender?.language_pref ?? 'not set'}. Consent: ${data.sender?.consent_at?.slice(0, 10) ?? 'none'}. Checks: ${data.claims.length}${lines.length ? `\n${lines.join('\n')}` : ''}\nReply DELETE to erase it.`
    await say(deps, e164, summary.slice(0, 900), lang)
    return
  }
  if (keyword?.kind === 'language') {
    await store.upsertSender({ sender_hash: hash, language_pref: keyword.lang })
    await say(deps, e164, LANGUAGE_SET_TEXT[keyword.lang], keyword.lang)
    return
  }

  const firstContact = !sender?.consent_at
  if (firstContact) {
    await store.upsertSender({ sender_hash: hash, consent_version: CONSENT_VERSION, consent_at: new Date().toISOString() })
    await deps.whatsapp.sendText(e164, `${SYSTEM_TEXT.consent}\n\n${SYSTEM_TEXT.languageMenu}`)
  }
  if (keyword?.kind === 'greeting') {
    if (!firstContact) await say(deps, e164, `${SYSTEM_TEXT.languageMenu} Send a message or screenshot to check it.`, lang)
    return
  }
  if (msg.type === 'other' || (!msg.text && !msg.mediaRef)) {
    await say(deps, e164, SYSTEM_TEXT.unsupported, lang)
    return
  }

  // Without OCR a bare screenshot has nothing to check; say so instead of queuing an empty claim.
  if (msg.mediaRef && !msg.text?.trim() && !deps.ocr.live) {
    await say(deps, e164, SYSTEM_TEXT.noScreenshots, lang)
    return
  }

  const claim = await store.createClaim({ channel: 'whatsapp', sender_hash: hash, is_demo: false })
  // Slow translation or a busy AI can stretch a check past a minute; tell the sender it is still going.
  let finished = false
  const holding = setTimeout(() => {
    if (!finished) sayQuick(deps, e164, `${SYSTEM_TEXT.stillChecking} Ticket #${ticketFor(claim.id)}.`, lang).catch(() => {})
  }, HOLDING_MESSAGE_MS)
  try {
    let image: Uint8Array | null = null
    if (msg.mediaRef) {
      const media = await deps.whatsapp.downloadMedia(msg.mediaRef)
      image = media.bytes
      if (deps.db) {
        const path = `${claim.id}.${media.mimeType.includes('png') ? 'png' : 'jpg'}`
        const up = await deps.db.storage.from(MEDIA_BUCKET).upload(path, media.bytes, { contentType: media.mimeType, upsert: true })
        if (!up.error) await store.updateClaim(claim.id, { image_path: path })
      }
    }
    const result = await runPipeline(
      { claimId: claim.id, text: msg.text, image, languageHint: null, replyLanguage: sender?.language_pref ?? null, isDemo: false },
      pipelineDeps(deps, origin),
    )
    finished = true
    clearTimeout(holding)
    if (!sender?.language_pref) await store.upsertSender({ sender_hash: hash, language_pref: result.replyLanguage })
    await deps.whatsapp.sendText(e164, result.reply)
    await store.addEvent({
      cluster_id: result.clusterId,
      claim_id: claim.id,
      kind: 'reply',
      detail: `${deps.whatsapp.live ? 'Reply sent' : 'Reply simulated (WhatsApp not configured)'} on WhatsApp in ${result.replyLanguage}.`,
    })
  } catch (err) {
    finished = true
    clearTimeout(holding)
    log.error({ stage: 'pipeline', claim_id: claim.id, message: (err as Error).message })
    await store.updateClaim(claim.id, { progress: 'failed', status: 'queued' })
    await say(deps, e164, `Received. Something went wrong while checking, so a fact-checker will review it by hand. Ticket #${ticketFor(claim.id)}.`, lang)
  }
}

/** Web checker: the claim row was created by check.ts; run the engine and leave the result on it. */
export async function processWebClaim(claimId: string, deps: ServerDeps, origin: string): Promise<void> {
  const claim = await deps.store.getClaim(claimId)
  if (!claim) return
  try {
    let image: Uint8Array | null = null
    if (claim.image_path && deps.db) {
      const { data } = await deps.db.storage.from(MEDIA_BUCKET).download(claim.image_path)
      if (data) image = new Uint8Array(await data.arrayBuffer())
    }
    const hint = claim.original_language
    await runPipeline(
      { claimId, text: claim.original_text, image, languageHint: hint, replyLanguage: hint, isDemo: claim.is_demo },
      pipelineDeps(deps, origin),
    )
  } catch (err) {
    deps.log.error({ stage: 'pipeline', claim_id: claimId, message: (err as Error).message })
    await deps.store.updateClaim(claimId, { progress: 'failed', status: 'queued' })
  }
}
