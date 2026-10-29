// The demo script (CLAUDE.md section 10, steps 1 to 6) end to end against the in-memory store,
// with a fake Sunbird and a capturing WhatsApp/mailer. No network.
import { randomBytes } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { localEmbedder, type ServerDeps } from '../engine/adapters'
import { memoryStore } from '../engine/memoryStore'
import { readConfig } from '../engine/config'
import { cannedLlm } from '../engine/adapters/llm'
import { cannedOcr } from '../engine/adapters/vision'
import { cannedFactCheck } from '../engine/adapters/factcheck'
import { cannedWebSearch } from '../engine/adapters/brave'
import type { InboundMessage, WhatsApp } from '../engine/adapters/greenapi'
import type { Mailer, RisingAlert } from '../engine/adapters/email'
import type { Translator } from '../engine/ports'
import { handleWhatsAppMessage } from '../netlify/lib/conversation'
import { simulateSpread } from '../netlify/lib/simulate'
import { publishVerdict } from '../netlify/lib/publish'

const JUDGE = '256700000001' // fictional test number
const OTHER = '256700000002'

// Fake Sunbird: recognises the Luganda demo sentence and marks translations into Luganda.
const translator: Translator = {
  live: true,
  detect: async (t) => (/Mmande/.test(t) ? 'lug' : 'eng'),
  translate: async (t, from, to) => {
    if (from === to) return t
    if (from === 'lug') return 'Monday is a public holiday, the ministry has announced.'
    return `[${to}] ${t}`
  },
}

function setup() {
  const sent: { to: string; body: string }[] = []
  const alerts: { to: string[]; alert: RisingAlert }[] = []
  const whatsapp: WhatsApp = {
    live: true,
    replyWindowMs: null,
    sendText: async (to, body) => void sent.push({ to, body }),
    downloadMedia: async () => {
      throw new Error('no media in this test')
    },
  }
  const mailer: Mailer = { live: true, sendRisingAlert: async (to, alert) => void alerts.push({ to, alert }) }
  const store = memoryStore()
  const config = readConfig({ DEMO_MODE: 'true', RISING_THRESHOLD: '20' })
  config.phoneHashSecret = randomBytes(32).toString('hex')
  config.replyAddressKey = randomBytes(32).toString('base64')
  const deps: ServerDeps = {
    config,
    status: { demo_mode: true, supabase: false, sunbird: true, llm: false, vision: false, factcheck: false, brave: false, whatsapp: true, email: true, privacy_keys: true },
    db: null,
    store,
    translator,
    llm: cannedLlm,
    ocr: cannedOcr,
    factcheck: cannedFactCheck,
    web: cannedWebSearch,
    whatsapp,
    mailer,
    embedder: localEmbedder,
    log: { info: vi.fn(), error: vi.fn() },
    now: () => new Date(),
  }
  return { deps, store, sent, alerts }
}

const message = (from: string, text: string): InboundMessage => ({ from, id: `m${Math.random()}`, timestamp: new Date(), type: 'text', text, mediaRef: null, mimeType: null })

describe('demo script, end to end', () => {
  it('runs steps 1 to 6', async () => {
    const { deps, store, sent, alerts } = setup()

    // 1-2. A judge sends a Luganda claim and gets consent, then a Luganda reply with a ticket.
    await handleWhatsAppMessage(message(JUDGE, 'Mmande lunaku lwa eggandaalo, minisitule erangiridde'), deps, 'http://localhost')
    expect(sent[0].body).toMatch(/Welcome to Sherlock/)
    const reply = sent[1]
    expect(reply.to).toBe(`+${JUDGE}`)
    expect(reply.body.startsWith('[lug] Received.')).toBe(true)
    const ticket = reply.body.match(/#(SH-[0-9A-F]{4})/)?.[1]
    expect(ticket).toBeTruthy()
    const claim = [...store.state.claims.values()][0]
    expect(claim).toMatchObject({ original_language: 'lug', status: 'queued', reply_language: 'lug' })

    // 3. Simulate spread: 1 -> 100, counted as simulated, one rising alert email.
    const clusterId = claim.cluster_id as string
    const sim = await simulateSpread(clusterId, { target: 100, stepDelayMs: 0, origin: 'http://localhost', actor: 'Demo Reporter' }, deps)
    expect(sim).toEqual({ from: 1, to: 100 })
    expect(store.state.clusters.get(clusterId)).toMatchObject({ report_count: 100, simulated_reports: 99 })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].alert).toMatchObject({ count: expect.any(Number), isDemo: true, language: 'Luganda' })
    expect(alerts[0].alert.dashboardUrl).toBe(`http://localhost/newsroom/claims/${claim.id}`)
    expect(store.state.alerts[0]).toMatchObject({ delivery: 'sent', is_demo: true })

    // 4-5. The demo journalist publishes "Likely false"; the judge gets the verdict in Luganda.
    const before = sent.length
    const result = await publishVerdict(
      {
        cluster_id: clusterId,
        label: 'likely_false',
        explanation_en: 'No public holiday has been declared for Monday. Holidays are announced by official notice only.',
        source_url: 'https://example.org/demo/ministry/public-holidays',
      },
      { id: null, display_name: 'Demo Reporter' },
      deps,
    )
    expect(result.delivery).toMatchObject({ sent: 1, failed: 0 })
    const verdictMsg = sent.slice(before)
    expect(verdictMsg).toHaveLength(1)
    expect(verdictMsg[0].to).toBe(`+${JUDGE}`)
    expect(verdictMsg[0].body).toMatch(/^\[lug\] Sherlock verdict, checked by a journalist: LIKELY FALSE\. \[lug\] No public holiday/)
    expect(verdictMsg[0].body).toContain(`Ticket #${ticket}`)
    expect(verdictMsg[0].body.endsWith('Source: https://example.org/demo/ministry/public-holidays')).toBe(true)
    expect(store.state.clusters.get(clusterId)?.status).toBe('published')
    expect(store.state.claims.get(claim.id)?.status).toBe('published')
    expect(store.state.outbound.map((o) => o.status)).toEqual(['sent'])

    // Library: a second person asking the same thing gets the verdict instantly.
    await handleWhatsAppMessage(message(OTHER, 'Mmande lunaku lwa eggandaalo, minisitule erangiridde'), deps, 'http://localhost')
    expect(sent[sent.length - 1]).toMatchObject({ to: `+${OTHER}` })
    expect(sent[sent.length - 1].body).toMatch(/LIKELY FALSE/)

    // 6. Privacy: no phone number appears anywhere in stored state except encrypted.
    const { addresses, ...rest } = store.state
    const dump = JSON.stringify(rest, (_k, v) => (v instanceof Map ? [...v.entries()] : v))
    for (const n of [JUDGE, OTHER]) {
      expect(dump).not.toContain(n.slice(3))
      expect(JSON.stringify([...addresses.values()])).not.toContain(n.slice(3))
    }
    expect(claim.sender_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('does not message people who opted out or erased their data', async () => {
    const { deps, store, sent } = setup()
    await handleWhatsAppMessage(message(JUDGE, 'Bus fares are free across the city from Friday'), deps, 'http://localhost')
    await handleWhatsAppMessage(message(OTHER, 'Bus fares are free across the city from Friday!'), deps, 'http://localhost')
    await handleWhatsAppMessage(message(JUDGE, 'STOP'), deps, 'http://localhost')
    await handleWhatsAppMessage(message(OTHER, 'DELETE'), deps, 'http://localhost')
    const clusterId = [...store.state.clusters.keys()][0]
    // DELETE removed OTHER's claims, so only JUDGE's claim remains to be delivered, and JUDGE opted out.
    const before = sent.length
    const r = await publishVerdict({ cluster_id: clusterId, label: 'likely_false', explanation_en: 'No fare change has been announced by the transport authority.' }, { id: null, display_name: 'Demo Reporter' }, deps)
    expect(r.delivery).toMatchObject({ sent: 0, failed: 1 })
    expect(sent.length).toBe(before)
  })

  it('records a failed alert when nobody is set to receive it', async () => {
    const { deps, store, alerts } = setup()
    store.state.alertEmails = []
    await handleWhatsAppMessage(message(JUDGE, 'Vaccination centres are closed this week'), deps, 'http://localhost')
    const clusterId = [...store.state.clusters.keys()][0]
    await simulateSpread(clusterId, { target: 30, stepDelayMs: 0, origin: 'http://localhost', actor: 'Demo Reporter' }, deps)
    expect(alerts).toHaveLength(0)
    expect(store.state.alerts[0]).toMatchObject({ delivery: 'failed', error: expect.stringMatching(/no recipients/) })
  })
})

describe('screenshots without OCR', () => {
  it('asks for the text instead of queuing an empty claim', async () => {
    const { deps, store, sent } = setup()
    await handleWhatsAppMessage(message(JUDGE, 'Hi Sherlock'), deps, 'http://localhost')
    const before = sent.length
    await handleWhatsAppMessage({ ...message(JUDGE, ''), text: null, type: 'image', mediaRef: 'https://media.example/x.jpg', mimeType: 'image/jpeg' }, deps, 'http://localhost')
    expect(sent.slice(before).map((m) => m.body)).toEqual([expect.stringMatching(/cannot read screenshots yet/)])
    expect(store.state.claims.size).toBe(0)
  })
})
