// Stage 1 intake. GET: Meta verification. POST: verify the signature, answer 200 fast, and hand
// the payload to process-message-background.
import { parseWebhook, verifyChallenge, verifySignature } from '../../engine/intake'
import { jsonLogger } from '../../engine/adapters'
import { siteOrigin, triggerBackground } from '../lib/http'

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  if (req.method === 'GET') {
    const challenge = verifyChallenge(url.searchParams, process.env.WHATSAPP_VERIFY_TOKEN ?? '')
    return challenge ? new Response(challenge, { status: 200 }) : new Response('Forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const raw = await req.text()
  if (!verifySignature(process.env.WHATSAPP_APP_SECRET ?? '', raw, req.headers.get('x-hub-signature-256'))) {
    jsonLogger.error({ stage: 'intake', event: 'bad_signature' })
    return new Response('Invalid signature', { status: 401 })
  }
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }
  // Status callbacks (sent, delivered, read) carry no messages; acknowledge and stop.
  if (parseWebhook(body).length > 0) {
    try {
      await triggerBackground(siteOrigin(req), { source: 'whatsapp', payload: body })
    } catch (err) {
      jsonLogger.error({ stage: 'intake', event: 'trigger_failed', message: (err as Error).message })
    }
  }
  return new Response('OK', { status: 200 })
}
