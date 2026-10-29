// Shared engine types. Pure data, no framework code.

export const LANGS = ['eng', 'lug', 'swa'] as const
export type Lang = (typeof LANGS)[number]

export const AI_LABELS = ['likely_false', 'likely_true', 'missing_context', 'under_investigation', 'unverified'] as const
export type AiLabel = (typeof AI_LABELS)[number]

export const DISORDERS = ['disinformation', 'misinformation', 'malinformation', 'none', 'unknown'] as const
export type Disorder = (typeof DISORDERS)[number]

export type EvidenceKind = 'official' | 'factcheck' | 'web' | 'image'

export interface Evidence {
  id: string
  kind: EvidenceKind
  title: string
  url: string
  snippet: string
  published_at: string | null
  source?: string
  /** True when the item comes from a canned fallback, not a live API. */
  demo?: boolean
}

export interface Assessment {
  label: AiLabel
  confidence: number
  evidence_ids: string[]
  disorder_hint: Disorder
  rationale: string
  reply_text: string
  missing_evidence: string
  /** Set when the assessment did not come from a live LLM call. */
  fallback?: 'parse_failure' | 'rate_limited' | 'no_llm' | 'error' | 'no_evidence'
}

export type ClaimStatus = 'received' | 'assessed' | 'queued' | 'published'
export type Channel = 'whatsapp' | 'web'
export type Stage = 'received' | 'normalise' | 'quick_check' | 'evidence' | 'assess' | 'reply' | 'done' | 'failed'

export interface ClaimRow {
  id: string
  cluster_id: string | null
  sender_hash: string | null
  channel: Channel
  original_text: string | null
  original_language: Lang | null
  text_en: string | null
  image_path: string | null
  image_phash: string | null
  ocr_text: string | null
  ai_label: AiLabel | null
  ai_confidence: number | null
  ai_rationale: string | null
  evidence: Evidence[]
  status: ClaimStatus
  progress: Stage
  reply_text: string | null
  /** English assessment reply, reused as a per-cluster cache. */
  ai_reply_en: string | null
  reply_language: Lang | null
  received_at: string
  is_demo: boolean
}

export interface ClusterRow {
  id: string
  canonical_text_en: string
  report_count: number
  simulated_reports: number
  first_seen: string
  last_seen: string
  status: 'open' | 'published'
  is_demo: boolean
}

export interface VerdictRow {
  id: string
  cluster_id: string
  label: AiLabel
  explanation_en: string
  explanation_lug: string | null
  explanation_swa: string | null
  source_url: string | null
  journalist_id: string | null
  published_at: string
}

export interface SenderRow {
  sender_hash: string
  language_pref: Lang | null
  consent_version: string | null
  consent_at: string | null
  opted_out: boolean
  last_message_at: string | null
}

export interface EncryptedAddress {
  address_ciphertext: string
  iv: string
  tag: string
}
