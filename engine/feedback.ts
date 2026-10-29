// Localising outgoing messages. Translation failures fall back to English with a short note,
// so a reply is never lost.
import type { Lang, VerdictRow } from './types'
import type { Logger, Translator } from './ports'
import { compose, LABEL_TEXT, type ReplyParts } from './reply'

const FALLBACK_NOTE: Record<Exclude<Lang, 'eng'>, string> = {
  lug: '(Translation unavailable, replying in English.)',
  swa: '(Translation unavailable, replying in English.)',
}

export async function localise(parts: ReplyParts, lang: Lang, translator: Translator, log: Logger): Promise<string> {
  if (lang === 'eng') return compose(parts)
  try {
    const body = await translator.translate(parts.body, 'eng', lang)
    return compose({ body, url: parts.url })
  } catch (err) {
    log.error({ stage: 'reply', event: 'translate_failed', message: (err as Error).message })
    return compose({ body: `${FALLBACK_NOTE[lang]} ${parts.body}`, url: parts.url })
  }
}

/**
 * Verdict message in the reader's language. Uses the journalist-reviewed explanation for that
 * language when stored, and machine-translates only the short header around it.
 */
export async function verdictMessage(
  v: Pick<VerdictRow, 'label' | 'explanation_en' | 'explanation_lug' | 'explanation_swa' | 'source_url'>,
  lang: Lang,
  ticket: string,
  translator: Translator,
  log: Logger,
): Promise<string> {
  const header = `Sherlock verdict, checked by a journalist: ${LABEL_TEXT[v.label].toUpperCase()}.`
  const footer = `Ticket #${ticket}.`
  if (lang === 'eng') return compose({ body: `${header} ${v.explanation_en} ${footer}`, url: v.source_url })
  const reviewed = lang === 'lug' ? v.explanation_lug : v.explanation_swa
  if (reviewed) {
    try {
      const localHeader = await translator.translate(header, 'eng', lang)
      return compose({ body: `${localHeader} ${reviewed} ${footer}`, url: v.source_url })
    } catch {
      return compose({ body: `${header} ${reviewed} ${footer}`, url: v.source_url })
    }
  }
  return localise({ body: `${header} ${v.explanation_en} ${footer}`, url: v.source_url }, lang, translator, log)
}
