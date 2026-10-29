// All WhatsApp code lives here: Green API (green-api.com), free Developer plan for the demo.
// Green API links a phone number as a WhatsApp Web device. It is not Meta's official API, so use
// a dedicated demo number, never a personal one.
//
// Webhook auth: set "webhookUrlToken" in the Green API console; Green API then sends
// `Authorization: Bearer <token>` with every webhook, which we compare in constant time.
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { fetchJson, fetchWithTimeout, HttpError } from './http'

interface GreenApiEnv {
  GREENAPI_URL?: string
  GREENAPI_ID_INSTANCE?: string
  GREENAPI_API_TOKEN_INSTANCE?: string
}

export interface WhatsApp {
  readonly live: boolean
  /** Meta enforces a 24-hour reply window; Green API does not. Null means no window. */
  readonly replyWindowMs: number | null
  sendText(to: string, body: string): Promise<void>
  /** `mediaRef` is the URL Green API put in the webhook. */
  downloadMedia(mediaRef: string): Promise<{ bytes: Uint8Array; mimeType: string }>
}

export interface InboundMessage {
  /** Sender's number as digits. Personal data: hash it, encrypt it, never log it. */
  from: string
  id: string
  timestamp: Date
  type: 'text' | 'image' | 'other'
  text: string | null
  mediaRef: string | null
  mimeType: string | null
}

// Webhook ---------------------------------------------------------------------------------------

/** Check the `Authorization: Bearer <GREENAPI_WEBHOOK_TOKEN>` header. */
export function verifyWebhookToken(expected: string, header: string | null): boolean {
  if (!expected) return false
  const given = Buffer.from((header ?? '').replace(/^Bearer\s+/i, ''))
  const want = Buffer.from(expected)
  return given.length === want.length && timingSafeEqual(given, want)
}

const FileData = z.object({ downloadUrl: z.string(), caption: z.string().optional(), mimeType: z.string().optional() })

const IncomingSchema = z.object({
  typeWebhook: z.string(),
  idMessage: z.string().optional(),
  timestamp: z.number().optional(),
  senderData: z.object({ chatId: z.string(), sender: z.string().optional() }).optional(),
  messageData: z
    .object({
      typeMessage: z.string(),
      textMessageData: z.object({ textMessage: z.string() }).optional(),
      extendedTextMessageData: z.object({ text: z.string() }).optional(),
      fileMessageData: FileData.optional(),
    })
    .optional(),
})

/**
 * Turn one Green API webhook into a user message. Returns null for everything we do not answer:
 * our own outgoing messages, status and state callbacks, and group chats (we only talk one to one).
 */
export function parseIncoming(body: unknown): InboundMessage | null {
  const parsed = IncomingSchema.safeParse(body)
  if (!parsed.success) return null
  const w = parsed.data
  if (w.typeWebhook !== 'incomingMessageReceived' || !w.senderData || !w.messageData) return null
  if (!w.senderData.chatId.endsWith('@c.us')) return null
  const m = w.messageData
  const base = {
    from: w.senderData.chatId.replace(/@c\.us$/, ''),
    id: w.idMessage ?? `${w.senderData.chatId}:${w.timestamp ?? Date.now()}`,
    timestamp: new Date((w.timestamp ?? Math.floor(Date.now() / 1000)) * 1000),
  }
  switch (m.typeMessage) {
    case 'textMessage':
      return { ...base, type: 'text', text: m.textMessageData?.textMessage ?? null, mediaRef: null, mimeType: null }
    case 'extendedTextMessage':
    case 'quotedMessage':
      return { ...base, type: 'text', text: m.extendedTextMessageData?.text ?? null, mediaRef: null, mimeType: null }
    case 'imageMessage':
      return { ...base, type: 'image', text: m.fileMessageData?.caption || null, mediaRef: m.fileMessageData?.downloadUrl ?? null, mimeType: m.fileMessageData?.mimeType ?? 'image/jpeg' }
    default:
      return { ...base, type: 'other', text: null, mediaRef: null, mimeType: null }
  }
}

/**
 * Optional allowlist, for when the linked phone is also used for other chats. When
 * WHATSAPP_ALLOWED_NUMBERS is defined, only those senders (comma-separated digits) are answered;
 * defined but empty means nobody. Undefined means everyone (a dedicated bot number).
 */
export function senderAllowed(from: string, allowed: string | undefined): boolean {
  if (allowed === undefined) return true
  const digits = from.replace(/\D/g, '')
  return allowed
    .split(',')
    .map((n) => n.replace(/\D/g, ''))
    .filter(Boolean)
    .includes(digits)
}

// Sending -------------------------------------------------------------------------------------

export function chatIdFor(phone: string): string {
  return `${phone.replace(/\D/g, '')}@c.us`
}

const SendResponse = z.object({ idMessage: z.string() })

export function greenApi(env: GreenApiEnv): WhatsApp {
  const base = (env.GREENAPI_URL || 'https://api.green-api.com').replace(/\/$/, '')
  const instance = env.GREENAPI_ID_INSTANCE
  const token = env.GREENAPI_API_TOKEN_INSTANCE
  return {
    live: true,
    replyWindowMs: null,
    async sendText(to, body) {
      const json = await fetchJson(`${base}/waInstance${instance}/sendMessage/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chatIdFor(to), message: body }),
        // Not retried (a retry could send twice), so allow for a slow connection.
        timeoutMs: 15000,
      })
      SendResponse.parse(json)
    },
    async downloadMedia(mediaRef) {
      // The URL arrives in a token-authenticated webhook; Green API serves files from its own
      // storage hosts, which vary, so require HTTPS rather than a fixed host list.
      if (new URL(mediaRef).protocol !== 'https:') throw new Error('refusing a non-HTTPS media URL')
      const res = await fetchWithTimeout(mediaRef, { timeoutMs: 10000, retries: 1 })
      if (!res.ok) throw new HttpError(res.status, `media download failed: HTTP ${res.status}`)
      return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType: res.headers.get('content-type') ?? 'image/jpeg' }
    },
  }
}

export interface DemoOutboxItem {
  /** Masked, e.g. +256•••••01. The full number is never kept. */
  to: string
  body: string
  at: string
}

/** Replies the demo fallback would have sent, newest last. In memory, local dev only. */
export const demoOutbox: DemoOutboxItem[] = []

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.length < 6 ? '•••' : `+${d.slice(0, 3)}${'•'.repeat(d.length - 5)}${d.slice(-2)}`
}

/** Demo fallback: nothing is sent; the reply is kept in the demo outbox for inspection. */
export const cannedWhatsApp: WhatsApp = {
  live: false,
  replyWindowMs: null,
  async sendText(to, body) {
    demoOutbox.push({ to: maskPhone(to), body, at: new Date().toISOString() })
    if (demoOutbox.length > 50) demoOutbox.shift()
  },
  async downloadMedia() {
    throw new Error('media download unavailable (demo mode, no Green API credentials)')
  },
}
