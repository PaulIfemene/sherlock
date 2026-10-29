// Stage 5: assessment. Builds the LLM request, validates its JSON with Zod, and enforces the
// rules from CLAUDE.md section 9 even when the model ignores them.
import { z } from 'zod'
import { AI_LABELS, DISORDERS, type Assessment, type Evidence, type Lang } from './types'
import { LlmRateLimitError, type ChatLLM, type Logger } from './ports'
import { loadPrompt } from './prompts'

export interface AssessInput {
  claim_en: string
  original_language: Lang
  evidence: Evidence[]
  image_context?: string
  /** YYYY-MM-DD, so the model can tell old evidence from claims about "next Monday". */
  today?: string
}

const AssessmentSchema = z.object({
  label: z.enum(AI_LABELS),
  confidence: z.coerce.number().min(0).max(1),
  // Models sometimes send null for optional fields; treat null as empty.
  evidence_ids: z.array(z.string()).nullish().transform((v) => v ?? []),
  disorder_hint: z.enum(DISORDERS).catch('unknown'),
  rationale: z.string().nullish().transform((v) => v ?? ''),
  reply_text: z.string().min(1),
  missing_evidence: z.string().nullish().transform((v) => v ?? ''),
})

const BANNED = /\b(fake|lie|lies|lying|liar|hoax(es)?)\b/gi

/** Remove words the citizen reply must never use, keeping the sentence readable. */
export function soften(text: string): string {
  return text
    .replace(BANNED, (w) => (w.toLowerCase().startsWith('hoax') ? 'unsupported claim' : 'not supported by the evidence'))
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '))
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd()) + (lastStop > max * 0.5 ? '' : '…')
}

export function underInvestigation(fallback: Assessment['fallback'], note?: string): Assessment {
  return {
    label: 'under_investigation',
    confidence: 0,
    evidence_ids: [],
    disorder_hint: 'unknown',
    rationale: note ?? 'No evidence item supported a conclusion, so the claim is queued for a journalist.',
    reply_text:
      'We could not find enough evidence to assess this yet. A fact-checker will review it and we will message you with the outcome.',
    missing_evidence: 'An official statement or a published fact-check that addresses the claim.',
    fallback,
  }
}

/** Strip a ```json fence or stray prose around the JSON object. */
function extractJson(raw: string): unknown {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('no JSON object')
  return JSON.parse(raw.slice(start, end + 1))
}

/**
 * Smooth over harmless format drift from the model before validation: "Likely False" or
 * "missing context" labels, numeric evidence IDs (1 -> e1), and "82%" confidences.
 */
export function normaliseAssessmentJson(json: unknown): unknown {
  if (!json || typeof json !== 'object') return json
  const o = { ...(json as Record<string, unknown>) }
  if (typeof o.label === 'string') o.label = o.label.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (Array.isArray(o.evidence_ids)) o.evidence_ids = o.evidence_ids.map((id) => (typeof id === 'number' ? `e${id}` : String(id).trim()))
  if (typeof o.confidence === 'string' && o.confidence.trim().endsWith('%')) o.confidence = Number(o.confidence.replace('%', '')) / 100
  if (typeof o.confidence === 'number' && o.confidence > 1 && o.confidence <= 100) o.confidence = o.confidence / 100
  return o
}

export type ParseOutcome = { assessment: Assessment; reason: null } | { assessment: null; reason: string }

/** Like parseAssessment, but says why a reply was rejected (for logs; contains no claim text). */
export function parseAssessmentDetailed(raw: string, evidence: Evidence[]): ParseOutcome {
  if (!raw.trim()) return { assessment: null, reason: 'empty reply' }
  let json: unknown
  try {
    json = extractJson(raw)
  } catch (err) {
    return { assessment: null, reason: `not JSON (${(err as Error).message.slice(0, 60)}), ${raw.length} chars` }
  }
  const parsed = AssessmentSchema.safeParse(normaliseAssessmentJson(json))
  if (!parsed.success) {
    return { assessment: null, reason: parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ').slice(0, 200) }
  }
  return { assessment: police(parsed.data, evidence), reason: null }
}

/**
 * Parse and police an LLM reply. Returns null when it is not valid JSON in the contract shape.
 * Rules enforced here: cited IDs must exist; no IDs means under_investigation; banned words removed;
 * reply under 400 characters.
 */
export function parseAssessment(raw: string, evidence: Evidence[]): Assessment | null {
  return parseAssessmentDetailed(raw, evidence).assessment
}

function police(a: z.infer<typeof AssessmentSchema>, evidence: Evidence[]): Assessment {
  const known = new Set(evidence.map((e) => e.id))
  const evidence_ids = [...new Set(a.evidence_ids.filter((id) => known.has(id)))]
  if (evidence_ids.length === 0) {
    return { ...underInvestigation('no_evidence'), missing_evidence: a.missing_evidence || underInvestigation('no_evidence').missing_evidence }
  }
  return {
    label: a.label,
    confidence: Math.round(a.confidence * 100) / 100,
    evidence_ids,
    disorder_hint: a.disorder_hint,
    rationale: truncate(a.rationale, 400),
    reply_text: truncate(soften(a.reply_text), 400),
    missing_evidence: a.missing_evidence,
  }
}

export function buildAssessUser(input: AssessInput): string {
  return JSON.stringify({
    claim_en: input.claim_en,
    original_language: input.original_language,
    evidence: input.evidence.map(({ id, kind, title, url, snippet, published_at }) => ({ id, kind, title, url, snippet, published_at })),
    image_context: input.image_context ?? null,
    today: input.today ?? null,
  })
}

/** Call the LLM, retry once on a parse failure, then fall back to under_investigation. */
export async function assess(input: AssessInput, llm: ChatLLM, log: Logger): Promise<Assessment> {
  if (input.evidence.length === 0) return underInvestigation('no_evidence')
  if (!llm.live) return cannedAssessment(input)
  const system = loadPrompt('assess.system.md')
  const user = buildAssessUser(input)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // Headroom for reasoning models (gpt-oss) that think before writing the JSON.
      const raw = await llm.complete({ system, user, json: true, maxTokens: 1200 })
      const { assessment, reason } = parseAssessmentDetailed(raw, input.evidence)
      if (assessment) return assessment
      log.info({ stage: 'assess', event: 'parse_failure', attempt, reason })
    } catch (err) {
      if (err instanceof LlmRateLimitError) {
        return underInvestigation('rate_limited', 'The free LLM tier hit its request cap, so this claim went straight to a journalist.')
      }
      log.error({ stage: 'assess', event: 'llm_error', attempt, message: (err as Error).message })
      if (attempt === 2) return underInvestigation('error')
    }
  }
  return underInvestigation('parse_failure')
}

/**
 * Rule-based stand-in used when no LLM key is configured. Labelled as a demo assessment.
 * It only leans on fact-check ratings, never on web results alone.
 */
export function cannedAssessment(input: AssessInput): Assessment {
  const falseCheck = input.evidence.find((e) => e.kind === 'factcheck' && /false|incorrect|misleading|fabricat/i.test(`${e.title} ${e.snippet}`))
  const official = input.evidence.find((e) => e.kind === 'official')
  if (falseCheck) {
    return {
      label: 'likely_false',
      confidence: 0.6,
      evidence_ids: [falseCheck.id],
      disorder_hint: 'unknown',
      rationale: `Demo assessment (no LLM key configured): a published fact-check rates a similar claim as false.`,
      reply_text: 'The evidence we found suggests this claim is not accurate: a published fact-check rates a similar claim as false.',
      missing_evidence: 'An official statement on the specific claim.',
      fallback: 'no_llm',
    }
  }
  return {
    ...underInvestigation('no_llm', 'Demo assessment (no LLM key configured): evidence was gathered but not weighed, so the claim is queued for a journalist.'),
    evidence_ids: official ? [official.id] : [],
  }
}

/** Queue for a journalist when uncertain. */
export function needsJournalist(a: Assessment, confidenceThreshold: number): boolean {
  return a.label === 'under_investigation' || a.label === 'unverified' || a.confidence < confidenceThreshold
}
