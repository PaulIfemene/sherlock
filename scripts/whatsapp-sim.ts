// Rehearse the WhatsApp flow without a phone: post a Green API-shaped webhook to the local dev
// server and print Sherlock's replies from the demo outbox.
//
//   npm run whatsapp:sim -- "Monday is a public holiday, the ministry said"
//   npm run whatsapp:sim -- --from 256700000002 STOP
//
// Needs `npm run dev` running, DEMO_MODE=true and no Green API credentials (so replies are canned).
// The default sender is a fictional test number.

const args = process.argv.slice(2)
const fromIdx = args.indexOf('--from')
const from = fromIdx >= 0 ? args.splice(fromIdx, 2)[1] : '256700000001'
const text = args.join(' ').trim() || 'Hi Sherlock'
const base = process.env.SIM_BASE_URL ?? 'http://localhost:5173'
const fn = (name: string) => `${base}/.netlify/functions/${name}`

interface Outbox {
  messages: { to: string; body: string; at: string }[]
}

async function outbox(): Promise<Outbox['messages']> {
  const res = await fetch(fn('demo-outbox'))
  if (!res.ok) throw new Error(`demo-outbox: HTTP ${res.status}. Is DEMO_MODE on and Green API unconfigured?`)
  return ((await res.json()) as Outbox).messages
}

const before = (await outbox()).length
const payload = {
  typeWebhook: 'incomingMessageReceived',
  instanceData: { idInstance: 0, wid: 'demo@c.us', typeInstance: 'whatsapp' },
  timestamp: Math.floor(Date.now() / 1000),
  idMessage: `SIM${Date.now()}`,
  senderData: { chatId: `${from}@c.us`, sender: `${from}@c.us`, senderName: 'Simulated sender' },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
}
const started = Date.now()
const res = await fetch(fn('whatsapp-webhook'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
console.log(`> ${text}\n  webhook: HTTP ${res.status}`)

// Replies arrive from the background function; wait until they stop coming.
let seen = before
let quietSince = Date.now()
while (Date.now() - started < 40_000 && Date.now() - quietSince < 4_000) {
  await new Promise((r) => setTimeout(r, 500))
  const msgs = await outbox()
  for (const m of msgs.slice(seen)) {
    console.log(`\n< [simulated reply to ${m.to}, ${((new Date(m.at).getTime() - started) / 1000).toFixed(1)} s]\n${m.body}`)
    quietSince = Date.now()
  }
  seen = Math.max(seen, msgs.length)
}
if (seen === before) console.log('\nNo reply within 40 s. Check the dev server terminal for errors.')
