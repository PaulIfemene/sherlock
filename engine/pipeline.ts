// Stages 2 to 7 for one claim that intake has already recorded. Shared by WhatsApp and /check.
import type { Assessment, ClaimStatus, Evidence, Lang } from './types'
import type { Deps } from './ports'
import { extractClaim, normaliseText } from './normalise'
import { quickCheck } from './quickCheck'
import { gatherEvidence } from './evidence'
import { assess, needsJournalist } from './assess'
import { formatAssessmentReply, ticketFor } from './reply'
import { localise, verdictMessage } from './feedback'
import { redact } from './privacy'

export interface PipelineInput {
  claimId: string
  text: string | null
  image: Uint8Array | null
  languageHint: Lang | null
  /** Sender's chosen reply language. Defaults to the detected language. */
  replyLanguage: Lang | null
  isDemo: boolean
}

export interface PipelineResult {
  claimId: string
  ticket: string
  clusterId: string
  status: ClaimStatus
  assessment: Assessment | null
  evidence: Evidence[]
  reply: string
  replyLanguage: Lang
  fromLibrary: boolean
  rising: boolean
}

export interface PipelineDeps extends Deps {
  hashImage?: (image: Uint8Array) => Promise<string | null>
}

/** Live assessments within this window are reused for later reports in the same cluster. */
const ASSESSMENT_CACHE_MS = 6 * 60 * 60 * 1000

export async function runPipeline(input: PipelineInput, deps: PipelineDeps): Promise<PipelineResult> {
  const { store, log } = deps
  const started = Date.now()
  const stage = async (name: 'normalise' | 'quick_check' | 'evidence' | 'assess' | 'reply') => {
    deps.onStage?.(name)
    await store.updateClaim(input.claimId, { progress: name })
    log.info({ stage: name, claim_id: input.claimId, duration_ms: Date.now() - started })
  }
  const ticket = ticketFor(input.claimId)

  // 2 Normalise ----------------------------------------------------------------------------------
  await stage('normalise')
  let ocrText: string | null = null
  let phash: string | null = null
  if (input.image) {
    const [ocr, hash] = await Promise.all([
      deps.ocr.extractText(input.image).catch((err: Error) => {
        log.error({ stage: 'normalise', event: 'ocr_failed', claim_id: input.claimId, message: err.message })
        return ''
      }),
      deps.hashImage ? deps.hashImage(input.image).catch(() => null) : Promise.resolve(null),
    ])
    ocrText = ocr ? redact(ocr) : null
    phash = hash
  }
  const sourceText = input.text?.trim() || ocrText || ''
  const norm = await normaliseText(sourceText, deps.translator, input.languageHint, log)
  // Screenshot text is translated separately only when there was no caption to go on.
  const extracted = await extractClaim(input.text?.trim() ? norm.text_en : '', input.text?.trim() ? ocrText : norm.text_en, deps.llm, log)
  const claimEn = extracted.claim || norm.text_en
  const replyLanguage = input.replyLanguage ?? norm.original_language
  await store.updateClaim(input.claimId, {
    original_text: norm.original_text,
    original_language: norm.original_language,
    text_en: claimEn,
    ocr_text: ocrText,
    image_phash: phash,
    reply_language: replyLanguage,
  })

  // 3 Quick check --------------------------------------------------------------------------------
  await stage('quick_check')
  const embedding = await deps.embedder.embed(claimEn)
  const qc = await quickCheck(claimEn, embedding, input.isDemo, deps)
  await store.updateClaim(input.claimId, { cluster_id: qc.clusterId })

  if (qc.verdict) {
    const reply = await verdictMessage(qc.verdict, replyLanguage, ticket, deps.translator, log)
    await store.updateClaim(input.claimId, {
      status: 'published',
      progress: 'done',
      ai_label: qc.verdict.label,
      ai_confidence: 1,
      ai_rationale: 'Matched a published verdict in the verified library.',
      reply_text: reply,
    })
    await store.addEvent({ cluster_id: qc.clusterId, claim_id: input.claimId, kind: 'library_match', detail: 'Answered from the verified library.' })
    return { claimId: input.claimId, ticket, clusterId: qc.clusterId, status: 'published', assessment: null, evidence: [], reply, replyLanguage, fromLibrary: true, rising: qc.rising }
  }

  // 4 Evidence and 5 Assessment, reusing a recent live assessment in the cluster ---------------
  let evidence: Evidence[]
  let assessment: Assessment
  const cached = qc.isNewCluster ? null : await store.recentAssessment(qc.clusterId, new Date(deps.now().getTime() - ASSESSMENT_CACHE_MS))
  if (cached?.ai_label && cached.ai_reply_en) {
    await stage('evidence')
    evidence = cached.evidence
    await stage('assess')
    assessment = {
      label: cached.ai_label,
      confidence: cached.ai_confidence ?? 0,
      evidence_ids: evidence.map((e) => e.id).slice(0, 2),
      disorder_hint: 'unknown',
      rationale: cached.ai_rationale ?? '',
      reply_text: cached.ai_reply_en,
      missing_evidence: '',
    }
    log.info({ stage: 'assess', claim_id: input.claimId, event: 'cache_hit' })
  } else {
    await stage('evidence')
    evidence = await gatherEvidence({ claimEn, embedding, phash, claimId: input.claimId }, deps)
    await store.updateClaim(input.claimId, { evidence })
    await stage('assess')
    const imageContext = ocrText
      ? [ocrText, extracted.post_author && `Post author: ${extracted.post_author}`, extracted.post_date && `Post date: ${extracted.post_date}`].filter(Boolean).join('\n')
      : undefined
    assessment = await assess({ claim_en: claimEn, original_language: norm.original_language, evidence, image_context: imageContext, today: deps.now().toISOString().slice(0, 10) }, deps.llm, log)
  }

  // 6 Reply -----------------------------------------------------------------------------------
  await stage('reply')
  const queued = needsJournalist(assessment, deps.config.confidenceThreshold)
  const parts = formatAssessmentReply({ assessment, evidence, ticket, queued })
  const reply = await localise(parts, replyLanguage, deps.translator, log)
  const status: ClaimStatus = queued ? 'queued' : 'assessed'
  await store.updateClaim(input.claimId, {
    ai_label: assessment.label,
    ai_confidence: assessment.confidence,
    ai_rationale: assessment.rationale,
    reply_text: reply,
    ai_reply_en: assessment.reply_text,
    status,
    progress: 'done',
  })

  // 7 Newsroom case ----------------------------------------------------------------------------
  await store.addEvent({
    cluster_id: qc.clusterId,
    claim_id: input.claimId,
    kind: queued ? 'queued' : 'assessed',
    detail: `AI suggestion: ${assessment.label} (${Math.round(assessment.confidence * 100)}%)${assessment.fallback ? `, fallback: ${assessment.fallback}` : ''}.`,
  })
  log.info({ stage: 'done', claim_id: input.claimId, status, duration_ms: Date.now() - started })
  return { claimId: input.claimId, ticket, clusterId: qc.clusterId, status, assessment, evidence, reply, replyLanguage, fromLibrary: false, rising: qc.rising }
}
