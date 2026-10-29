// Stage 1: intake. Keywords and system messages. Webhook parsing is in adapters/greenapi.ts.
import type { Lang } from './types'

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
  stopped: 'You will no longer get messages from Sherlock. Reply START to resume.',
  started: 'Welcome back. Send a message you want checked.',
  deleted: 'Your Sherlock data has been erased. Any new message starts fresh.',
  unsupported: 'Sherlock can check text and images for now. Please send the message as text or a screenshot.',
} as const

export const LANGUAGE_SET_TEXT: Record<Lang, string> = {
  eng: 'Thanks. Sherlock will reply in English.',
  lug: 'Thanks. Sherlock will reply in Luganda.',
  swa: 'Thanks. Sherlock will reply in Kiswahili.',
}
