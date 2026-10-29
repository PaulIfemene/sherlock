// Stage 6: reply formatting. English text first, under 600 characters, one source link at most.
// Formatters return the body and link separately so only the body goes through translation.
import type { AiLabel, Assessment, Evidence, Lang, VerdictRow } from './types'

export const MAX_REPLY = 600

export const LABEL_TEXT: Record<AiLabel, string> = {
  likely_false: 'likely false',
  likely_true: 'likely true',
  missing_context: 'missing context',
  under_investigation: 'under investigation',
  unverified: 'unverified',
}

/** Human ticket number derived from the claim UUID, e.g. `SH-4F2A`. */
export function ticketFor(claimId: string): string {
  return `SH-${claimId.replace(/-/g, '').slice(0, 4).toUpperCase()}`
}

export interface ReplyParts {
  body: string
  url: string | null
}

function clamp(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

/** Join body and link, trimming the body so the link always survives. */
export function compose({ body, url }: ReplyParts, max = MAX_REPLY): string {
  if (!url) return clamp(body, max)
  const tail = `\nSource: ${url}`
  return `${clamp(body, Math.max(80, max - tail.length))}${tail}`
}

export interface ReplyInput {
  assessment: Assessment
  evidence: Evidence[]
  ticket: string
  queued: boolean
}

export function formatAssessmentReply({ assessment, evidence, ticket, queued }: ReplyInput): ReplyParts {
  const url = evidence.find((e) => e.id === assessment.evidence_ids[0])?.url ?? null
  if (queued) {
    const body =
      assessment.label === 'under_investigation'
        ? `Received. A fact-checker is reviewing this claim. Ticket #${ticket}. We will message you when a verdict is published.`
        : `Received. Our check so far suggests this is ${LABEL_TEXT[assessment.label]}. ${assessment.reply_text} A fact-checker is reviewing it. Ticket #${ticket}.`
    return { body, url }
  }
  return { body: `${assessment.reply_text} (Suggested by Sherlock, not a final verdict. Ticket #${ticket}.)`, url }
}

/** The stored explanation in the reader's language, or null when it was not translated. */
export function verdictExplanation(v: Pick<VerdictRow, 'explanation_en' | 'explanation_lug' | 'explanation_swa'>, lang: Lang): string | null {
  if (lang === 'lug') return v.explanation_lug
  if (lang === 'swa') return v.explanation_swa
  return v.explanation_en
}

export function formatVerdictReply(v: Pick<VerdictRow, 'label' | 'explanation_en' | 'source_url'>, ticket: string): ReplyParts {
  return {
    body: `Sherlock verdict, checked by a journalist: ${LABEL_TEXT[v.label].toUpperCase()}. ${v.explanation_en} Ticket #${ticket}.`,
    url: v.source_url,
  }
}
