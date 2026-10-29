// Point the Green API instance's webhook at this app, with the bearer token from .env.
//   npm run greenapi:webhook -- https://<tunnel>.trycloudflare.com
//   npm run greenapi:webhook -- --show        (print current settings, token hidden)
import 'dotenv/config'

const { GREENAPI_URL, GREENAPI_ID_INSTANCE, GREENAPI_API_TOKEN_INSTANCE, GREENAPI_WEBHOOK_TOKEN } = process.env
if (!GREENAPI_URL || !GREENAPI_ID_INSTANCE || !GREENAPI_API_TOKEN_INSTANCE) {
  console.error('Set GREENAPI_URL, GREENAPI_ID_INSTANCE and GREENAPI_API_TOKEN_INSTANCE in .env first.')
  process.exit(1)
}
const api = (method: string) => `${GREENAPI_URL}/waInstance${GREENAPI_ID_INSTANCE}/${method}/${GREENAPI_API_TOKEN_INSTANCE}`

async function show() {
  const s = (await (await fetch(api('getSettings'))).json()) as Record<string, unknown>
  const state = (await (await fetch(api('getStateInstance'))).json()) as Record<string, unknown>
  console.log(`State: ${state.stateInstance}`)
  console.log(`Webhook URL: ${s.webhookUrl || '(none)'}`)
  console.log(`Webhook token set: ${s.webhookUrlToken ? 'yes' : 'no'}`)
  console.log(`Incoming messages webhook: ${s.incomingWebhook}   Outgoing: ${s.outgoingWebhook}   API outgoing: ${s.outgoingAPIMessageWebhook}`)
}

const arg = process.argv[2]
if (!arg || arg === '--show') {
  await show()
  process.exit(0)
}
if (!GREENAPI_WEBHOOK_TOKEN) {
  console.error('Set GREENAPI_WEBHOOK_TOKEN in .env first (npm run keys:generate).')
  process.exit(1)
}
const base = arg.replace(/\/$/, '')
const webhookUrl = base.includes('/.netlify/functions/') ? base : `${base}/.netlify/functions/whatsapp-webhook`
const res = await fetch(api('setSettings'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    webhookUrl,
    webhookUrlToken: GREENAPI_WEBHOOK_TOKEN,
    incomingWebhook: 'yes',
    // We only need incoming messages; our own sends would only be ignored.
    outgoingWebhook: 'no',
    outgoingAPIMessageWebhook: 'no',
    outgoingMessageWebhook: 'no',
    stateWebhook: 'no',
    deviceWebhook: 'no',
  }),
})
console.log(`setSettings: HTTP ${res.status} ${await res.text()}`)
await show()
