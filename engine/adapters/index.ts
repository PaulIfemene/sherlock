// Build engine dependencies from the environment. Each external API falls back to a clearly
// labelled canned adapter when its key is missing, so the demo never crashes.
import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { has, readConfig } from '../config'
import type { Embedder, EvidenceSearch, Logger } from '../ports'
import type { PipelineDeps } from '../pipeline'
import { embedLocal } from '../embed'
import { memoryStore } from '../memoryStore'
import { cannedTranslator, sunbirdTranslator } from './sunbird'
import { cannedLlm, openAiCompatibleLlm } from './llm'
import { cannedOcr, googleVisionOcr } from './vision'
import { cannedFactCheck, googleFactCheck } from './factcheck'
import { braveSearch, cannedWebSearch } from './brave'
import { cannedWhatsApp, greenApi, type WhatsApp } from './greenapi'
import { cannedMailer, smtpMailer, type Mailer } from './email'
import { imagePhash } from './phash'
import { serviceClient, supabaseStore } from './supabaseStore'

type Env = Record<string, string | undefined>

/** Structured JSON logs. Callers must never pass phone numbers, tokens or decrypted addresses. */
export const jsonLogger: Logger = {
  info: (event) => console.log(JSON.stringify({ level: 'info', ...event })),
  error: (event) => console.error(JSON.stringify({ level: 'error', ...event })),
}

const noEvidence: EvidenceSearch = {
  live: false,
  async search() {
    return []
  },
}

export const localEmbedder: Embedder = {
  async embed(text) {
    return embedLocal(text)
  },
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

export function integrationStatus(env: Env): IntegrationStatus {
  return {
    demo_mode: readConfig(env).demoMode,
    supabase: has(env, 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'),
    sunbird: has(env, 'SUNBIRD_API_TOKEN') || has(env, 'SUNBIRD_USERNAME', 'SUNBIRD_PASSWORD'),
    llm: has(env, 'LLM_API_KEY'),
    vision: has(env, 'GOOGLE_VISION_API_KEY'),
    factcheck: has(env, 'GOOGLE_FACTCHECK_API_KEY'),
    brave: has(env, 'BRAVE_SEARCH_API_KEY'),
    whatsapp: has(env, 'GREENAPI_URL', 'GREENAPI_ID_INSTANCE', 'GREENAPI_API_TOKEN_INSTANCE'),
    email: has(env, 'SMTP_USER', 'SMTP_APP_PASSWORD'),
    privacy_keys: has(env, 'PHONE_HASH_SECRET', 'REPLY_ADDRESS_KEY'),
  }
}

let fallbackStore: ReturnType<typeof memoryStore> | null = null

// Demo fallback when the privacy keys are missing: random per-process keys, never stored. Hashes
// and encrypted addresses stop matching after a restart, so production must set real keys.
const ephemeral = { hash: randomBytes(32).toString('hex'), address: randomBytes(32).toString('base64') }
let warnedEphemeral = false

export interface ServerDeps extends PipelineDeps {
  db: SupabaseClient | null
  whatsapp: WhatsApp
  mailer: Mailer
  status: IntegrationStatus
}

export function buildDeps(env: Env = process.env): ServerDeps {
  const status = integrationStatus(env)
  const config = readConfig(env)
  if (!config.phoneHashSecret || !config.replyAddressKey) {
    config.phoneHashSecret ||= ephemeral.hash
    config.replyAddressKey ||= ephemeral.address
    if (!warnedEphemeral) jsonLogger.error({ stage: 'config', event: 'ephemeral_privacy_keys', message: 'PHONE_HASH_SECRET or REPLY_ADDRESS_KEY missing; using random demo keys for this process' })
    warnedEphemeral = true
  }
  const liveEvidence = status.brave || status.factcheck
  const db = status.supabase ? serviceClient(env.VITE_SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string) : null
  if (!db) fallbackStore ??= memoryStore()
  return {
    config,
    status,
    db,
    store: db ? supabaseStore(db) : (fallbackStore as ReturnType<typeof memoryStore>),
    translator: status.sunbird ? sunbirdTranslator(env) : cannedTranslator,
    llm: status.llm ? openAiCompatibleLlm(env) : cannedLlm,
    ocr: status.vision ? googleVisionOcr(env.GOOGLE_VISION_API_KEY as string) : cannedOcr,
    // Simulated evidence only when no live search is configured at all. Once any real source is
    // live, a missing one contributes nothing rather than mixing simulated items into real checks.
    factcheck: status.factcheck ? googleFactCheck(env.GOOGLE_FACTCHECK_API_KEY as string) : liveEvidence ? noEvidence : cannedFactCheck,
    web: status.brave ? braveSearch(env.BRAVE_SEARCH_API_KEY as string) : liveEvidence ? noEvidence : cannedWebSearch,
    whatsapp: status.whatsapp ? greenApi(env) : cannedWhatsApp,
    mailer: status.email ? smtpMailer(env) : cannedMailer,
    embedder: localEmbedder,
    hashImage: imagePhash,
    log: jsonLogger,
    now: () => new Date(),
  }
}
