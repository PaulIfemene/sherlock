// Stage 1 intake for Green API. Check the webhook token, answer 200 fast, and hand user messages
// to process-message-background. Point the Green API console's webhook URL here.
import { jsonLogger } from '../../engine/adapters'
import { parseIncoming, senderAllowed, verifyWebhookToken } from '../../engine/adapters/greenapi'
import { isLocal, siteOrigin, triggerBackground } from '../lib/http'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const token = process.env.GREENAPI_WEBHOOK_TOKEN ?? ''
  // Without a token, accept only local test webhooks in demo mode (scripts/whatsapp-sim.ts).
  const localDemo = !token && process.env.DEMO_MODE !== 'false' && isLocal(req)
  if (!localDemo && !verifyWebhookToken(token, req.headers.get('authorization'))) {
    jsonLogger.error({ stage: 'intake', event: 'bad_webhook_token' })
    return new Response('Unauthorized', { status: 401 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }
  // Our own outgoing messages, delivery statuses and state changes need no answer.
  const msg = parseIncoming(body)
  // Delivery trace: event type and chat kind only, never the number or text.
  const typeWebhook = (body as { typeWebhook?: unknown })?.typeWebhook
  jsonLogger.info({ stage: 'intake', event: 'webhook', type: typeof typeWebhook === 'string' ? typeWebhook : 'unknown', user_message: Boolean(msg) })
  if (msg && !senderAllowed(msg.from, process.env.WHATSAPP_ALLOWED_NUMBERS)) {
    // Not on the allowlist: do not process or reply. Never log the number.
    jsonLogger.info({ stage: 'intake', event: 'ignored_not_allowlisted' })
    return new Response('OK', { status: 200 })
  }
  if (msg) {
    try {
      await triggerBackground(siteOrigin(req), { source: 'whatsapp', payload: body })
    } catch (err) {
      jsonLogger.error({ stage: 'intake', event: 'trigger_failed', message: (err as Error).message })
    }
  }
  return new Response('OK', { status: 200 })
}
