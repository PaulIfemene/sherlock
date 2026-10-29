// Stage 1: intake. Webhook verification, payload parsing and keyword handling.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import type { Lang } from './types'

/** Meta's GET verification handshake. Returns the challenge to echo, or null to reject. */
export function verifyChallenge(params: URLSearchParams, verifyToken: string): string | null {
  if (!verifyToken) return null
  if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === verifyToken) {
    return params.get('hub.challenge')
  }
  return null
}

/** Check `X-Hub-Signature-256` against HMAC-SHA256(appSecret, rawBody). */
export function verifySignature(appSecret: string, rawBody: string, header: string | null): boolean {
  if (!appSecret || !header?.startsWith('sha256=')) return false
  const expected = Buffer.from(`sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`)
  const given = Buffer.from(header)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

const MessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  image: z.object({ id: z.string(), mime_type: z.string().optional(), caption: z.string().optional() }).optional(),
})

const WebhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            messages: z.array(MessageSchema).optional(),
          }).loose(),
        }),
      ),
    }),
  ),
})

export interface InboundMessage {
  /** WhatsApp wa_id. Personal data: hash it, encrypt it, never log it. */
  from: string
  id: string
  timestamp: Date
  type: 'text' | 'image' | 'other'
  text: string | null
  mediaId: string | null
}

/** Pull user messages out of a webhook body. Status callbacks and unknown shapes yield []. */
export function parseWebhook(body: unknown): InboundMessage[] {
  const parsed = WebhookSchema.safeParse(body)
  if (!parsed.success) return []
  const out: InboundMessage[] = []
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue
      for (const m of change.value.messages ?? []) {
        const type = m.type === 'text' ? 'text' : m.type === 'image' ? 'image' : 'other'
        out.push({
          from: m.from,
          id: m.id,
          timestamp: new Date(Number(m.timestamp) * 1000),
          type,
          text: m.text?.body ?? m.image?.caption ?? null,
          mediaId: m.image?.id ?? null,
        })
      }
    }
  }
  return out
}

export type Keyword =
  | { kind: 'stop' }
  | { kind: 'start' }
  | { kind: 'delete' }
  | { kind: 'mydata' }
  | { kind: 'language'; lang: Lang }
  | { kind: 'greeting' }

const GREETINGS = ['hi', 'hello', 'hey', 'hi sherlock', 'hello sherlock', 'oli otya', 'gyebale ko', 'habari', 'jambo', 'mambo', 'start']

/** Recognise control keywords. Anything else is treated as a claim. */
export function parseKeyword(text: string | null): Keyword | null {
  if (!text) return null
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, '')
  if (t === 'stop' || t === 'unsubscribe') return { kind: 'stop' }
  if (t === 'start' || t === 'resume') return { kind: 'start' }
  if (t === 'delete') return { kind: 'delete' }
  if (t === 'mydata' || t === 'my data') return { kind: 'mydata' }
  if (t === '1') return { kind: 'language', lang: 'eng' }
  if (t === '2') return { kind: 'language', lang: 'lug' }
  if (t === '3') return { kind: 'language', lang: 'swa' }
  if (GREETINGS.includes(t)) return { kind: 'greeting' }
  return null
}

export const CONSENT_VERSION = 'v1-2026-10'

/** System messages. English source; translated at send time when Sunbird is available. */
export const SYSTEM_TEXT = {
  consent:
    'Welcome to Sherlock. Send a message or screenshot you want checked. We store a scrambled ID, not your number, and delete images within 24 hours. Reply STOP to opt out, DELETE to erase your data, MYDATA for a copy.',
  languageMenu: 'Choose your language: 1 English, 2 Luganda, 3 Kiswahili.',
  languageSet: 'Thanks. Sherlock will reply in English.',
  stopped: 'You will no longer get messages from Sherlock. Reply START to resume.',
  started: 'Welcome back. Send a message you want checked.',
  deleted: 'Your Sherlock data has been erased. Any new message starts fresh.',
  optedOutIgnored: '',
  unsupported: 'Sherlock can check text and images for now. Please send the message as text or a screenshot.',
} as const

export const LANGUAGE_SET_TEXT: Record<Lang, string> = {
  eng: 'Thanks. Sherlock will reply in English.',
  lug: 'Thanks. Sherlock will reply in Luganda.',
  swa: 'Thanks. Sherlock will reply in Kiswahili.',
}
