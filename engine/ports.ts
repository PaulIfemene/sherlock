// Adapter interfaces the engine depends on. Real and canned implementations live in adapters/.
import type {
  AiLabel,
  Assessment,
  ClaimRow,
  ClusterRow,
  EncryptedAddress,
  Evidence,
  Lang,
  SenderRow,
  Stage,
  VerdictRow,
} from './types'
import type { EngineConfig } from './config'

export interface Translator {
  /** True when backed by the live Sunbird API. */
  readonly live: boolean
  detect(text: string): Promise<Lang | null>
  translate(text: string, from: Lang, to: Lang): Promise<string>
}

export interface ChatRequest {
  system: string
  user: string
  json?: boolean
  maxTokens?: number
}

export class LlmRateLimitError extends Error {
  constructor() {
    super('LLM rate limit reached')
  }
}

export interface ChatLLM {
  readonly live: boolean
  complete(req: ChatRequest): Promise<string>
}

export interface Ocr {
  readonly live: boolean
  extractText(image: Uint8Array): Promise<string>
}

export interface EvidenceSearch {
  readonly live: boolean
  search(query: string): Promise<Omit<Evidence, 'id'>[]>
}

export interface Embedder {
  embed(text: string): Promise<number[]>
}

export interface Logger {
  info(event: Record<string, unknown>): void
  error(event: Record<string, unknown>): void
}

export type NewClaim = Pick<ClaimRow, 'channel' | 'sender_hash' | 'is_demo'> &
  Partial<Pick<ClaimRow, 'original_text' | 'image_path' | 'original_language'>>

export interface ClusterMatch {
  cluster: Pick<ClusterRow, 'id' | 'canonical_text_en' | 'status' | 'report_count'>
  similarity: number
}

export interface Store {
  // Senders and reply addresses (service role only).
  getSender(hash: string): Promise<SenderRow | null>
  upsertSender(sender: Partial<SenderRow> & { sender_hash: string }): Promise<void>
  saveReplyAddress(hash: string, channel: 'whatsapp' | 'web', enc: EncryptedAddress): Promise<void>
  getReplyAddress(hash: string): Promise<(EncryptedAddress & { channel: 'whatsapp' | 'web' }) | null>
  eraseSender(hash: string): Promise<void>
  exportSender(hash: string): Promise<{ sender: SenderRow | null; claims: Pick<ClaimRow, 'id' | 'received_at' | 'text_en' | 'status'>[] }>

  // Claims and clusters.
  createClaim(claim: NewClaim): Promise<ClaimRow>
  updateClaim(id: string, patch: Partial<ClaimRow>): Promise<void>
  getClaim(id: string): Promise<ClaimRow | null>
  matchCluster(embedding: number[], threshold: number): Promise<ClusterMatch | null>
  createCluster(textEn: string, embedding: number[], isDemo: boolean): Promise<ClusterRow>
  bumpCluster(clusterId: string, by: number, at: Date, simulated?: boolean): Promise<{ before: number; after: number }>
  clusterVelocity(clusterId: string, now: Date): Promise<{ lastHour: number; prevHour: number }>
  getVerdict(clusterId: string): Promise<VerdictRow | null>
  /** Most recent live assessment in the cluster since `since`, used as a per-claim LLM cache. */
  recentAssessment(clusterId: string, since: Date): Promise<Pick<ClaimRow, 'ai_label' | 'ai_confidence' | 'ai_rationale' | 'evidence' | 'ai_reply_en'> | null>

  // Evidence.
  matchSourceItems(embedding: number[], limit: number): Promise<Omit<Evidence, 'id'>[]>
  claimsWithPhash(limit: number): Promise<Pick<ClaimRow, 'id' | 'image_phash' | 'text_en' | 'received_at' | 'cluster_id'>[]>

  addEvent(event: { cluster_id?: string | null; claim_id?: string | null; kind: string; detail: string; actor?: string }): Promise<void>
}

export interface Deps {
  config: EngineConfig
  translator: Translator
  llm: ChatLLM
  ocr: Ocr
  factcheck: EvidenceSearch
  web: EvidenceSearch
  embedder: Embedder
  store: Store
  log: Logger
  now: () => Date
  /** Optional hook, e.g. to send the rising-claim email. */
  onRising?: (clusterId: string, count: number) => Promise<void>
  onStage?: (stage: Stage) => void
}

export type { AiLabel, Assessment }
