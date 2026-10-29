// Stage 2: normalise. Language detection, translation to English, and single-claim extraction.
import { z } from 'zod'
import type { Lang } from './types'
import type { ChatLLM, Logger, Translator } from './ports'
import { loadPrompt } from './prompts'
import { redact } from './privacy'

// Frequent function words, used when Sunbird language ID is unavailable.
const MARKERS: Record<Exclude<Lang, 'eng'>, string[]> = {
  lug: ['ku', 'mu', 'nti', 'naye', 'era', 'olw', 'abantu', 'ekyo', 'kino', 'bwe', 'gavumenti', 'oluvannyuma', 'wiiki', 'leero', 'enkya', 'eggandaalo', 'balangiridde', 'okuva', 'ssente', 'nnyo', 'ye', 'ba'],
  swa: ['na', 'ya', 'wa', 'kwa', 'ni', 'za', 'katika', 'kuwa', 'hii', 'serikali', 'siku', 'leo', 'kesho', 'watu', 'sikukuu', 'imetangaza', 'kwamba', 'pia', 'hakuna', 'sana', 'wiki'],
}
const ENGLISH = ['the', 'is', 'and', 'of', 'to', 'in', 'that', 'will', 'be', 'on', 'for', 'are', 'has', 'from', 'government', 'public', 'holiday']

/** Best-effort offline language guess. Returns `eng` when nothing stands out. */
export function guessLanguage(text: string): Lang {
  const words = text.toLowerCase().split(/[^\p{L}']+/u).filter(Boolean)
  if (words.length === 0) return 'eng'
  const score = (list: string[]) => words.filter((w) => list.includes(w)).length
  const eng = score(ENGLISH)
  const lug = score(MARKERS.lug) + words.filter((w) => /^(ng|ny|ky|gy|bw|mw)[aeiou]/.test(w) || /[aeiou]{2}$/.test(w)).length * 0.3
  const swa = score(MARKERS.swa) + words.filter((w) => /^(wa|ma|ki|vi|ku)[a-z]{3,}/.test(w)).length * 0.2
  const best = Math.max(eng, lug, swa)
  if (best === 0 || best === eng) return 'eng'
  return lug >= swa ? 'lug' : 'swa'
}

export interface Normalised {
  original_text: string
  original_language: Lang
  text_en: string
}

/** Redact, detect the language (hint > Sunbird > heuristic) and translate to English. */
export async function normaliseText(raw: string, translator: Translator, hint: Lang | null, log: Logger): Promise<Normalised> {
  const original_text = redact(raw)
  let lang: Lang = hint ?? 'eng'
  if (!hint) {
    try {
      lang = (await translator.detect(original_text)) ?? guessLanguage(original_text)
    } catch (err) {
      log.error({ stage: 'normalise', event: 'detect_failed', message: (err as Error).message })
      lang = guessLanguage(original_text)
    }
  }
  let text_en = original_text
  if (lang !== 'eng') {
    try {
      text_en = await translator.translate(original_text, lang, 'eng')
    } catch (err) {
      log.error({ stage: 'normalise', event: 'translate_failed', message: (err as Error).message })
    }
  }
  return { original_text, original_language: lang, text_en: redact(text_en) }
}

const ExtractSchema = z.object({
  claim: z.string(),
  checkable: z.boolean().catch(true),
  post_author: z.string().nullish(),
  post_date: z.string().nullish(),
})

export interface Extracted {
  claim: string
  checkable: boolean
  post_author: string | null
  post_date: string | null
}

/** First sentence, used when no LLM is available or extraction fails. */
export function firstSentence(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const end = clean.search(/[.!?](\s|$)/)
  const s = end > 20 ? clean.slice(0, end + 1) : clean
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

export async function extractClaim(textEn: string, ocrText: string | null, llm: ChatLLM, log: Logger): Promise<Extracted> {
  const source = [textEn, ocrText ? `Screenshot text:\n${ocrText}` : ''].filter(Boolean).join('\n\n')
  const fallback: Extracted = { claim: firstSentence(textEn || ocrText || ''), checkable: true, post_author: null, post_date: null }
  if (!llm.live || !source.trim()) return fallback
  try {
    const raw = await llm.complete({ system: loadPrompt('extract.system.md'), user: redact(source), json: true, maxTokens: 700 })
    const start = raw.indexOf('{')
    const parsed = ExtractSchema.safeParse(JSON.parse(raw.slice(start, raw.lastIndexOf('}') + 1)))
    if (!parsed.success || !parsed.data.claim.trim()) return fallback
    return {
      claim: redact(parsed.data.claim.trim()),
      checkable: parsed.data.checkable,
      post_author: parsed.data.post_author ?? null,
      post_date: parsed.data.post_date ?? null,
    }
  } catch (err) {
    log.error({ stage: 'normalise', event: 'extract_failed', message: (err as Error).message })
    return fallback
  }
}
