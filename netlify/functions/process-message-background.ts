// Stages 2 to 7 for WhatsApp messages and web checks. Background function: Netlify replies 202
// to the caller immediately and lets this run for up to 15 minutes.
import { z } from 'zod'
import { buildDeps } from '../../engine/adapters'
import { parseIncoming } from '../../engine/adapters/greenapi'
import { handleWhatsAppMessage, processWebClaim } from '../lib/conversation'
import { isInternal, siteOrigin } from '../lib/http'
import { applySettings } from '../lib/settings'

const Payload = z.discriminatedUnion('source', [
  z.object({ source: z.literal('whatsapp'), payload: z.unknown() }),
  z.object({ source: z.literal('web'), claim_id: z.string().uuid() }),
])

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST' || !isInternal(req)) return new Response('Forbidden', { status: 403 })
  const parsed = Payload.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return new Response('Bad payload', { status: 400 })
  const deps = await applySettings(buildDeps())
  const origin = siteOrigin(req)
  if (parsed.data.source === 'web') {
    await processWebClaim(parsed.data.claim_id, deps, origin)
  } else {
    const msg = parseIncoming(parsed.data.payload)
    if (msg) {
      try {
        await handleWhatsAppMessage(msg, deps, origin)
      } catch (err) {
        deps.log.error({ stage: 'intake', event: 'message_failed', message: (err as Error).message })
      }
    }
  }
  return new Response('Done', { status: 200 })
}
