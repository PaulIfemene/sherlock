// Calls to the Netlify Functions. Journalist calls carry the Supabase session token.
import { supabase } from './supabase'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(name: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (init.auth && supabase) {
    const { data } = await supabase.auth.getSession()
    if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`)
  }
  let res: Response
  try {
    res = await fetch(`/.netlify/functions/${name}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Network error. Check your connection and try again.')
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`)
  return body as T
}

export interface IntegrationStatus {
  demo_mode: boolean
  supabase: boolean
  sunbird: boolean
  llm: boolean
  vision: boolean
  factcheck: boolean
  brave: boolean
  whatsapp: boolean
  email: boolean
  privacy_keys: boolean
}

export interface EvidenceItem {
  id: string
  kind: 'official' | 'factcheck' | 'web' | 'image'
  title: string
  url: string
  snippet: string
  published_at: string | null
  source?: string
  demo?: boolean
}

export interface CheckResult {
  id: string
  ticket: string
  progress: 'received' | 'normalise' | 'quick_check' | 'evidence' | 'assess' | 'reply' | 'done' | 'failed'
  status: 'received' | 'assessed' | 'queued' | 'published'
  text_en: string | null
  original_language: string | null
  label: string | null
  confidence: number | null
  reply: string | null
  evidence: EvidenceItem[]
  verdict: { label: string; explanation_en: string; source_url: string | null; published_at: string } | null
}

export interface DeliveryCounts {
  sent: number
  simulated: number
  needs_template: number
  failed: number
  web: number
}

export const api = {
  status: () => call<IntegrationStatus>('status'),
  startCheck: (body: { text: string; image_base64?: string; image_type?: string; language: string; client_id: string }) =>
    call<{ id: string; token: string; ticket: string }>('check', { method: 'POST', body: JSON.stringify(body) }),
  checkResult: (id: string, token: string) => call<CheckResult>(`check?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`),
  publish: (body: { cluster_id: string; label: string; explanation_en: string; explanation_lug?: string | null; explanation_swa?: string | null; source_url?: string | null }) =>
    call<{ verdict_id: string; delivery: DeliveryCounts }>('publish-verdict', { method: 'POST', body: JSON.stringify(body), auth: true }),
  simulate: (cluster_id: string, target = 100) => call<{ from: number; to: number; simulated: number }>('simulate', { method: 'POST', body: JSON.stringify({ cluster_id, target }), auth: true }),
  translate: (text: string, to: 'lug' | 'swa') => call<{ text: string | null; live: boolean; note?: string }>('translate', { method: 'POST', body: JSON.stringify({ text, to }), auth: true }),
  scrapeSource: (source_id: string) => call<{ ok: boolean; items: number; error?: string }>('scrape-source', { method: 'POST', body: JSON.stringify({ source_id }), auth: true }),
  claimMedia: (claim_id: string) => call<{ url: string | null; reverse: { name: string; url: string }[] }>(`claim-media?claim_id=${encodeURIComponent(claim_id)}`, { auth: true }),
}

/** Anonymous per-browser ID for the web checker. Hashed server-side like a phone number. */
export function webClientId(): string {
  const key = 'sherlock.client_id'
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(key, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

export const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.replace(/\D/g, '') ?? ''
export const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi Sherlock')}`
