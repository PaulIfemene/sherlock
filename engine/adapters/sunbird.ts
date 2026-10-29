// Sunbird AI: language ID and translation between English, Luganda and Kiswahili.
// Auth: SUNBIRD_API_TOKEN if set, otherwise a bearer token from /auth/token (valid 7 days), cached.
import { z } from 'zod'
import { LANGS, type Lang } from '../types'
import type { Translator } from '../ports'
import { fetchJson } from './http'

const BASE = 'https://api.sunbird.ai'
const TOKEN_TTL_MS = 6 * 24 * 60 * 60 * 1000

interface SunbirdEnv {
  SUNBIRD_API_TOKEN?: string
  SUNBIRD_USERNAME?: string
  SUNBIRD_PASSWORD?: string
}

let cachedToken: { token: string; expires: number } | null = null

async function token(env: SunbirdEnv): Promise<string> {
  if (env.SUNBIRD_API_TOKEN) return env.SUNBIRD_API_TOKEN
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.token
  const body = new URLSearchParams({ username: env.SUNBIRD_USERNAME ?? '', password: env.SUNBIRD_PASSWORD ?? '' })
  const json = await fetchJson(`${BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    timeoutMs: 8000,
  })
  const parsed = z.object({ access_token: z.string() }).parse(json)
  cachedToken = { token: parsed.access_token, expires: Date.now() + TOKEN_TTL_MS }
  return parsed.access_token
}

/** The translate response shape has changed across API versions; accept the known ones. */
export function readTranslation(json: unknown): string {
  const pick = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
  const o = (json ?? {}) as Record<string, unknown>
  const out = (o.output ?? {}) as Record<string, unknown>
  const text = pick(out.translated_text) ?? pick(out.text) ?? pick(o.translated_text) ?? pick(o.text) ?? pick(o.output)
  if (!text) throw new Error('Sunbird translate: unexpected response shape')
  return text
}

export function sunbirdTranslator(env: SunbirdEnv): Translator {
  const auth = async () => ({ Authorization: `Bearer ${await token(env)}`, 'Content-Type': 'application/json' })
  return {
    live: true,
    async detect(text) {
      const json = await fetchJson(`${BASE}/tasks/language_id`, {
        method: 'POST',
        headers: await auth(),
        body: JSON.stringify({ text: text.slice(0, 500) }),
        // Language ID is optional (a local guess backs it up), so never wait long for it.
        timeoutMs: 8000,
      })
      const lang = z.object({ language: z.string() }).safeParse(json)
      const code = lang.success ? lang.data.language.toLowerCase() : ''
      return (LANGS as readonly string[]).includes(code) ? (code as Lang) : null
    },
    async translate(text, from, to) {
      if (from === to || !text.trim()) return text
      const json = await fetchJson(`${BASE}/tasks/translate`, {
        method: 'POST',
        headers: await auth(),
        body: JSON.stringify({ source_language: from, target_language: to, text }),
        // Warm calls take 2-3 s, a cold model ~35 s. Cap the wait so a reply never stalls for minutes;
        // on failure the sender gets English with a note.
        timeoutMs: 40000,
      })
      return readTranslation(json)
    },
  }
}

/** Fallback when Sunbird is not configured: no detection, and translation reports failure. */
export const cannedTranslator: Translator = {
  live: false,
  async detect() {
    return null
  },
  async translate(text, from, to) {
    if (from === to) return text
    throw new Error('translation unavailable (demo mode, no Sunbird credentials)')
  },
}
