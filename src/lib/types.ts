// Row shapes the dashboard reads. Mirrors supabase/migrations; never includes reply addresses.
import type { EvidenceItem } from './api'
import type { ClaimStatus, Label, Lang } from './format'

export interface Cluster {
  id: string
  canonical_text_en: string
  report_count: number
  simulated_reports: number
  first_seen: string
  last_seen: string
  status: 'open' | 'published'
  is_demo: boolean
}

export interface Claim {
  id: string
  cluster_id: string | null
  sender_hash: string | null
  channel: 'whatsapp' | 'web'
  original_text: string | null
  original_language: Lang | null
  text_en: string | null
  image_path: string | null
  ocr_text: string | null
  ai_label: Label | null
  ai_confidence: number | null
  ai_rationale: string | null
  evidence: EvidenceItem[]
  status: ClaimStatus
  progress: string
  received_at: string
  is_demo: boolean
}

export interface CountPoint {
  cluster_id: string
  bucket: string
  count: number
}

export interface Verdict {
  id: string
  cluster_id: string
  label: Label
  explanation_en: string
  explanation_lug: string | null
  explanation_swa: string | null
  source_url: string | null
  journalist_id: string | null
  published_at: string
}

export interface Alert {
  id: string
  cluster_id: string
  sent_to: string[]
  sent_at: string
  delivery: 'sent' | 'simulated' | 'failed'
  error: string | null
  is_demo: boolean
}

export interface Source {
  id: string
  name: string
  url: string
  kind: 'rss' | 'page'
  selector: string | null
  interval_minutes: number
  trusted_because: string | null
  enabled: boolean
  last_success_at: string | null
  last_error: string | null
  last_checked_at: string | null
}

export interface EventRow {
  id: string
  cluster_id: string | null
  claim_id: string | null
  kind: string
  detail: string
  actor: string | null
  created_at: string
}

export interface Outbound {
  id: string
  claim_id: string
  status: 'pending' | 'sent' | 'needs_template' | 'failed'
}

export interface Journalist {
  id: string
  display_name: string
  newsroom: string
  email: string
  receives_alerts: boolean
}
